import "server-only";

import { UniqueConstraintError } from "sequelize";

import {
  CurrentUserNotFoundError,
  EmailAlreadyExistsError,
  UserTypeAlreadySelectedError,
} from "./errors";
import { hashPassword, verifyPassword } from "./password";
import {
  toSafeUser,
  type SafeUser,
  type UserId,
} from "./user-types";
import {
  credentialsSchema,
  normalizeEmail,
  registrationSchema,
  userTypeSelectionSchema,
} from "./validation";
import {
  UserRepository,
  type UserRepositoryPort,
} from "../db/repositories/user-repository";
import { AdminRepository } from "../db/repositories/admin-repository";
import { toSafeAdmin, type SafeAdmin } from "./admin-types";

export type AuthenticatedAccount =
  | { readonly accountType: "USER"; readonly account: SafeUser }
  | { readonly accountType: "ADMIN"; readonly account: SafeAdmin };

export class AuthService {
  private userRepository: UserRepositoryPort | undefined;

  constructor(userRepository?: UserRepositoryPort) {
    this.userRepository = userRepository;
  }

  private getUserRepository(): UserRepositoryPort {
    if (!this.userRepository) {
      this.userRepository = new UserRepository();
    }
    return this.userRepository;
  }

  async register(input: unknown): Promise<SafeUser> {
    const data = registrationSchema.parse(input);
    const email = normalizeEmail(data.email);
    const userRepository = this.getUserRepository();

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new EmailAlreadyExistsError();
    }

    const passwordHash = await hashPassword(data.password);

    try {
      const user = await userRepository.create({ email, passwordHash });
      return toSafeUser(user);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }

  async selectInitialUserType(
    input: unknown,
    userId: UserId,
  ): Promise<SafeUser> {
    const data = userTypeSelectionSchema.parse(input);
    const userRepository = this.getUserRepository();
    const updatedUser = await userRepository.setInitialUserType(
      userId,
      data.userType,
    );

    if (updatedUser) {
      return toSafeUser(updatedUser);
    }

    const currentUser = await userRepository.findById(userId);
    if (!currentUser) {
      throw new CurrentUserNotFoundError();
    }

    throw new UserTypeAlreadySelectedError();
  }

  async validateCredentials(input: unknown): Promise<AuthenticatedAccount | null> {
    const parsedInput = credentialsSchema.safeParse(input);
    if (!parsedInput.success) {
      return null;
    }

    const email = normalizeEmail(parsedInput.data.email);
    const admin = await new AdminRepository().findByEmail(email);
    if (admin) {
      const isValid = await verifyPassword(parsedInput.data.password, admin.passwordHash);
      return isValid ? { accountType: "ADMIN", account: toSafeAdmin(admin) } : null;
    }

    const user = await this.getUserRepository().findByEmail(email);
    if (!user) return null;
    const isValid = await verifyPassword(
      parsedInput.data.password,
      user.passwordHash,
    );
    return isValid ? { accountType: "USER", account: toSafeUser(user) } : null;
  }
}
