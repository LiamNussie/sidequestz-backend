export type JwtPayload = {
  sub: string;
  email: string;
  role: 'user' | 'admin';
};

export type RefreshJwtPayload = JwtPayload & {
  refreshToken: string;
};
