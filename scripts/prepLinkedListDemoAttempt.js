require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const AssessmentUserMapping = require('../models/AssessmentUserMapping');

const PYTHON_LINKED_LIST_HELPERS = `class Node:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


def build_list(values):
    dummy = Node(0)
    cur = dummy
    for value in values:
        cur.next = Node(value)
        cur = cur.next
    return dummy.next


def print_list(head):
    values = []
    while head:
        values.append(str(head.val))
        head = head.next
    print(" ".join(values))


def read_list_from_input():
    raw_n = input().strip()
    if raw_n == "":
        return None
    n = int(raw_n)
    if n <= 0:
        return None
    values = list(map(int, input().split()))
    return build_list(values[:n])
`;

const PYTHON_REORDER = `${PYTHON_LINKED_LIST_HELPERS}

def reorder_list(head):
    # Write your solution here.
    # Reorder as: first -> last -> second -> second-last -> ...
    # Return the new head.
    return head


if __name__ == "__main__":
    head = read_list_from_input()
    head = reorder_list(head)
    print_list(head)
`;

const PYTHON_PALINDROME = `${PYTHON_LINKED_LIST_HELPERS}

def is_palindrome(head):
    # Write your solution here.
    # Return True if the list is a palindrome, otherwise False.
    return True


if __name__ == "__main__":
    head = read_list_from_input()
    print("Yes" if is_palindrome(head) else "No")
`;

const JAVA_REORDER = `import java.util.*;

class Node {
    int val;
    Node next;
    Node(int val) { this.val = val; }
}

public class Solution {
    static Node reorderList(Node head) {
        // Write your solution here.
        return head;
    }

    static Node buildList(int[] values) {
        Node dummy = new Node(0);
        Node cur = dummy;
        for (int value : values) {
            cur.next = new Node(value);
            cur = cur.next;
        }
        return dummy.next;
    }

    static void printList(Node head) {
        StringBuilder sb = new StringBuilder();
        while (head != null) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(head.val);
            head = head.next;
        }
        System.out.println(sb.toString());
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) {
            System.out.println();
            return;
        }
        int n = sc.nextInt();
        int[] values = new int[Math.max(n, 0)];
        for (int i = 0; i < n && sc.hasNextInt(); i++) {
            values[i] = sc.nextInt();
        }
        Node head = buildList(values);
        head = reorderList(head);
        printList(head);
    }
}
`;

const JAVA_PALINDROME = `import java.util.*;

class Node {
    int val;
    Node next;
    Node(int val) { this.val = val; }
}

public class Solution {
    static boolean isPalindrome(Node head) {
        // Write your solution here.
        return true;
    }

    static Node buildList(int[] values) {
        Node dummy = new Node(0);
        Node cur = dummy;
        for (int value : values) {
            cur.next = new Node(value);
            cur = cur.next;
        }
        return dummy.next;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) {
            System.out.println("Yes");
            return;
        }
        int n = sc.nextInt();
        int[] values = new int[Math.max(n, 0)];
        for (int i = 0; i < n && sc.hasNextInt(); i++) {
            values[i] = sc.nextInt();
        }
        Node head = buildList(values);
        System.out.println(isPalindrome(head) ? "Yes" : "No");
    }
}
`;

async function upsertTemplate(questionId, languageName, templateCode) {
  const [langs] = await pool.execute('SELECT id FROM languages WHERE name = ?', [languageName]);
  if (!langs[0]) throw new Error(`Language not found: ${languageName}`);
  const [existing] = await pool.execute(
    'SELECT id FROM code_templates WHERE programming_question_id = ? AND language_id = ?',
    [questionId, langs[0].id]
  );
  if (existing[0]) {
    await pool.execute(
      'UPDATE code_templates SET template_code = ? WHERE id = ?',
      [templateCode, existing[0].id]
    );
  } else {
    await pool.execute(
      'INSERT INTO code_templates (programming_question_id, language_id, template_code) VALUES (?, ?, ?)',
      [questionId, langs[0].id, templateCode]
    );
  }
}

(async () => {
  const adminId = 11;
  const email = 'demouser@gmail.com';

  await pool.execute(
    `UPDATE proctoring_configs
     SET full_screen_mandatory = 0,
         webcam_required = 0,
         max_tab_switch_allowed = -1
     WHERE assessment_administrator_id = ?`,
    [adminId]
  );
  console.log('Disabled fullscreen/webcam/tab-switch limits for admin', adminId);

  await upsertTemplate(18, 'Python', PYTHON_REORDER);
  await upsertTemplate(19, 'Python', PYTHON_PALINDROME);
  await upsertTemplate(18, 'Java', JAVA_REORDER);
  await upsertTemplate(19, 'Java', JAVA_PALINDROME);
  console.log('Updated Python/Java starter templates with function stubs + stdin drivers');

  const [users] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (!users[0]) throw new Error('Demo user not found');
  const userId = users[0].id;

  const passwordHash = await bcrypt.hash('12345678', 10);
  await pool.execute('UPDATE users SET password = ?, password_set = TRUE WHERE id = ?', [passwordHash, userId]);
  console.log('Password reset for', email);

  await pool.execute(
    'UPDATE access_configs SET max_attempts = GREATEST(COALESCE(max_attempts, 1), 20) WHERE assessment_administrator_id = ?',
    [adminId]
  );

  await pool.execute(
    `UPDATE assessment_user_mappings
     SET status = 'COMPLETED', submitted_at = COALESCE(submitted_at, NOW())
     WHERE user_id = ? AND assessment_administrator_id = ? AND status = 'IN_PROGRESS'`,
    [userId, adminId]
  );

  const [latest] = await pool.execute(
    `SELECT id FROM assessment_user_mappings
     WHERE user_id = ? AND assessment_administrator_id = ?
     ORDER BY attempt_number DESC LIMIT 1`,
    [userId, adminId]
  );
  const result = await AssessmentUserMapping.createReattempt(latest[0].id);
  console.log('New attempt created:', result);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
