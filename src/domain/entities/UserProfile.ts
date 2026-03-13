export interface UserProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  updatedAt: string;
}

export interface UpdateUserProfileInput {
  email: string;
  firstName: string;
  lastName: string;
}
