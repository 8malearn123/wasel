/**
 * The merchant_users columns the app may read.
 *
 * login_code is deliberately absent: the database no longer grants it to
 * signed-in users, so `select('*')` on this table now fails. A code is read
 * one at a time through the get_user_login_code() function, which answers an
 * owner/admin of the same merchant, or the user themselves.
 */
export const MERCHANT_USER_COLUMNS =
  'id, merchant_id, user_id, role, branch_id, is_active, created_at, updated_at';
