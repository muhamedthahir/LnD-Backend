const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCreateInstitutionInput(body = {}) {
  const { name, admin_name, admin_email, alternate_email } = body;

  if (!name || !admin_name || !admin_email) {
    return {
      ok: false,
      status: 400,
      error: 'Institution name, admin name, and admin email are required'
    };
  }

  if (alternate_email && !EMAIL_RE.test(String(alternate_email).trim())) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid alternate email format'
    };
  }

  return { ok: true };
}

function normalizeInstitutionCreatePayload(body = {}) {
  const trimOrNull = (value) => {
    if (value == null) return null;
    const text = String(value).trim();
    return text ? text : null;
  };

  return {
    name: String(body.name || '').trim(),
    admin_name: String(body.admin_name || '').trim(),
    admin_email: String(body.admin_email || '').trim(),
    address: trimOrNull(body.address),
    spoc_contact_number: trimOrNull(body.spoc_contact_number),
    alternate_contact: trimOrNull(body.alternate_contact),
    alternate_email: trimOrNull(body.alternate_email),
    status: body.status === 'inactive' ? 'inactive' : 'active'
  };
}

module.exports = {
  validateCreateInstitutionInput,
  normalizeInstitutionCreatePayload
};
