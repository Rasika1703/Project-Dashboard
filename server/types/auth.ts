export type UserRole =
  | 'ADMIN'
  | 'PROJECT_MANAGER'
  | 'DEVELOPER';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}
