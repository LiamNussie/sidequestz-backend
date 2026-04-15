import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type AuthenticatedUser = {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  refreshToken?: string;
};

export const CurrentUser = createParamDecorator<
  keyof AuthenticatedUser | undefined
>((data: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
  const request = context
    .switchToHttp()
    .getRequest<{ user: AuthenticatedUser }>();
  const user = request.user;

  return data ? user?.[data] : user;
});
