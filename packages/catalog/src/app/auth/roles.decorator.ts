import { SetMetadata } from '@nestjs/common';

export const ROLES = Symbol('ROLES');

type Roles = 'admins' | 'managers';

export const Roles = (roles: Roles[]) => SetMetadata(ROLES, roles);
