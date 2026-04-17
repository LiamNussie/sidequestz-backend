import {
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UserGender, UserRole, UserSocials } from './schemas/user.schema';
import { UsersService } from './users.service';

type UserResponse = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  isOnboarded: boolean;
  totalXp: number;
  username: string | null;
  dateOfBirth: string | null;
  gender: UserGender | null;
  avatar: string | null;
  profileImages: string[];
  socials: UserSocials;
};

const isAtLeast18YearsOld = (date: Date): boolean => {
  const now = new Date();
  const threshold = new Date(
    now.getFullYear() - 18,
    now.getMonth(),
    now.getDate(),
  );
  return date <= threshold;
};

@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get()
  async findAll(@Query() query: GetUsersQueryDto) {
    const result = await this.usersService.findAllUsers({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      search: query.search,
    });

    return {
      ...result,
      data: result.data.map((user) => this.toUserResponse(user)),
    };
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toUserResponse(user);
  }

  @Patch('me')
  async updateMyProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateMyProfileDto,
  ) {
    const existingUser = await this.usersService.findById(userId);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const payload: {
      name?: string;
      username?: string;
      dateOfBirth?: Date;
      gender?: UserGender;
      avatar?: string;
      profileImages?: string[];
      socials?: UserSocials;
    } = {};

    if (dto.name !== undefined) {
      payload.name = dto.name.trim();
    }

    if (dto.username !== undefined) {
      const normalizedUsername = dto.username.trim().toLowerCase();
      const usernameOwner =
        await this.usersService.findByUsername(normalizedUsername);
      if (usernameOwner && usernameOwner.id !== userId) {
        throw new ConflictException('Username is already taken');
      }
      payload.username = normalizedUsername;
    }

    if (dto.dateOfBirth !== undefined) {
      const dob = new Date(dto.dateOfBirth);
      if (Number.isNaN(dob.getTime())) {
        throw new BadRequestException('dateOfBirth must be a valid date');
      }
      if (!isAtLeast18YearsOld(dob)) {
        throw new BadRequestException('You must be at least 18 years old');
      }
      payload.dateOfBirth = dob;
    }

    if (dto.gender !== undefined) {
      payload.gender = dto.gender;
    }

    if (dto.avatar !== undefined) {
      payload.avatar = dto.avatar.trim();
    }

    if (dto.profileImages !== undefined) {
      payload.profileImages = dto.profileImages;
    }

    if (dto.socials !== undefined) {
      const socials: UserSocials = {
        x: dto.socials.x?.trim() || '',
        instagram: dto.socials.instagram?.trim() || '',
        tiktok: dto.socials.tiktok?.trim() || '',
      };
      if (!socials.x && !socials.instagram && !socials.tiktok) {
        throw new BadRequestException(
          'At least one social handle is required (x, instagram, or tiktok)',
        );
      }
      payload.socials = socials;
    }

    const updated = await this.usersService.updateProfile(userId, payload);
    if (!updated) {
      throw new NotFoundException('User not found');
    }

    this.notificationsService.notifyProfileUpdated(userId);

    return this.toUserResponse(updated);
  }

  @Delete('me')
  async deleteMyAccount(@CurrentUser('userId') userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.notificationsService.notifyAccountDeleted(user.email);
    await this.notificationsService.purgeUserData(userId);
    await this.usersService.deleteUserById(userId);
    return { message: 'Account deleted successfully' };
  }

  private toUserResponse(user: {
    id: string;
    email: string;
    name: string;
    role?: UserRole;
    emailVerified?: boolean;
    isOnboarded?: boolean;
    totalXp?: number;
    username?: string | null;
    dateOfBirth?: Date | string | null;
    gender?: UserGender | null;
    avatar?: string | null;
    profileImages?: string[];
    socials?: UserSocials;
  }): UserResponse {
    const dobValue = user.dateOfBirth;
    const dateOfBirth =
      dobValue instanceof Date
        ? dobValue.toISOString()
        : typeof dobValue === 'string'
          ? dobValue
          : null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role ?? 'user',
      emailVerified: user.emailVerified === true,
      isOnboarded: user.isOnboarded === true,
      totalXp: user.totalXp ?? 0,
      username: user.username ?? null,
      dateOfBirth,
      gender: user.gender ?? null,
      avatar: user.avatar ?? null,
      profileImages: user.profileImages ?? [],
      socials: user.socials ?? { x: '', instagram: '', tiktok: '' },
    };
  }
}
