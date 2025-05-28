import { Config, User, UserRole } from '@types/index';
import { DEFAULT_CONFIG, API_ENDPOINTS } from '@constants/index';
import { safeJsonParse, delay, createErrorHandler } from '@utils/index';

export class UserService {
  private config: Config;
  private errorHandler: (error: Error) => void;

  constructor(config: Partial<Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.errorHandler = createErrorHandler();
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      await delay(100);
      
      return {
        id,
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: UserRole.USER,
        createdAt: new Date()
      };
    } catch (error) {
      this.errorHandler(error as Error);
      return null;
    }
  }

  async updateUser(user: Partial<User> & { id: string }): Promise<boolean> {
    try {
      await delay(100);
      
      console.log(`User updated: ${user.id}`);
      return true;
    } catch (error) {
      this.errorHandler(error as Error);
      return false;
    }
  }
}