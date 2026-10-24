const ADMIN_ROLES = new Set(['primary_admin', 'campuszen_admin', 'college_admin']);
const fail = (status, message) => Object.assign(new Error(message), { status });

function checkAdmin(actor) {
  if (!actor || !ADMIN_ROLES.has(actor.role)) throw fail(403, 'Administrator access required');
  if (actor.role === 'college_admin' && !actor.college_name) {
    throw fail(403, 'Your account must be assigned to an institution');
  }
}

function validateReset({ groupId, password }) {
  if (!['string', 'number'].includes(typeof groupId) || !/^[1-9]\d*$/.test(String(groupId)) || !Number.isSafeInteger(Number(groupId))) {
    throw fail(400, 'Select a valid group');
  }
  if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
    throw fail(400, 'Password must be at least 6 characters and no more than 72 UTF-8 bytes');
  }
}

// Dependencies are injected so regression tests never connect to or reset real accounts.
function createBulkPasswordResetService({ db, hashPassword, ensureResetColumns }) {
  return {
    async listGroups(actor, { search = '', limit = 50, offset = 0 } = {}) {
      checkAdmin(actor);
      const pageSize = Math.max(1, Math.min(50, Number.parseInt(limit, 10) || 50));
      const parsedOffset = Number.parseInt(offset, 10);
      const start = Number.isSafeInteger(parsedOffset) ? Math.max(0, parsedOffset) : 0;
      const conditions = [];
      const params = [];
      if (actor.role === 'college_admin') {
        conditions.push('g.college_name = ?');
        params.push(actor.college_name);
      }
      if (search) {
        conditions.push('(g.name LIKE ? OR g.college_name LIKE ?)');
        const term = `%${String(search).trim().slice(0, 100)}%`;
        params.push(term, term);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const [[groups], [counts]] = await Promise.all([
        db.execute(`SELECT g.id, g.name, g.college_name,
          (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
          FROM \`groups\` g ${where} ORDER BY g.name, g.id LIMIT ${pageSize} OFFSET ${start}`, params),
        db.execute(`SELECT COUNT(*) AS total FROM \`groups\` g ${where}`, params)
      ]);
      return { groups, total: Number(counts[0].total), limit: pageSize, offset: start };
    },

    async reset(actor, input) {
      checkAdmin(actor);
      validateReset(input);
      // Complete compatibility migrations before opening a transaction (DDL auto-commits).
      await ensureResetColumns();
      const connection = await db.getConnection();
      let started = false;
      try {
        await connection.beginTransaction();
        started = true;
        const [[group]] = await connection.execute('SELECT id, name, college_name FROM `groups` WHERE id = ? FOR UPDATE', [Number(input.groupId)]);
        if (!group) throw fail(404, 'Group not found');
        if (actor.role === 'college_admin' && group.college_name !== actor.college_name) {
          throw fail(403, 'You can only reset groups from your institution');
        }
        const [members] = await connection.execute(
          `SELECT u.id, u.role, u.college_name FROM users u
           INNER JOIN group_members gm ON gm.user_id = u.id
           WHERE gm.group_id = ? ORDER BY u.id FOR UPDATE`, [group.id]
        );
        if (!members.length) throw fail(400, 'This group has no users to reset');
        // Groups contain students. Reject inconsistent memberships as a whole rather
        // than silently resetting only a subset or changing another admin's credentials.
        if (members.some(user => user.role !== 'student' ||
          (actor.role === 'college_admin' && user.college_name !== actor.college_name))) {
          throw fail(403, 'All group members must be students you are allowed to manage. No passwords were changed.');
        }
        // Every member receives the same requested password; hash it once instead of
        // occupying the bcrypt worker pool once per member.
        const passwordHash = await hashPassword(input.password, 10);
        for (let start = 0; start < members.length; start += 500) {
          const ids = members.slice(start, start + 500).map(user => user.id);
          const placeholders = ids.map(() => '?').join(',');
          await connection.execute(
            `UPDATE users SET password = ?, password_set = TRUE, otp = NULL, otp_expires_at = NULL,
             reset_token = NULL, reset_token_expires_at = NULL WHERE id IN (${placeholders})`,
            [passwordHash, ...ids]
          );
          try {
            await connection.execute(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id IN (${placeholders}) AND revoked = FALSE`, ids);
          } catch (error) {
            // Older installations without refresh tokens have no sessions to revoke.
            if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
          }
        }
        await connection.commit();
        started = false;
        return { groupId: group.id, groupName: group.name, updatedCount: members.length };
      } catch (error) {
        if (started) await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

module.exports = { createBulkPasswordResetService, validateReset };
