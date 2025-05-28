export * from '@types/index';
export * from '@constants/index';
export * from '@utils/index';
export * from '@services/index';

import { Config } from '@types/index';
import { DEFAULT_CONFIG } from '@constants/index';
import { UserService } from '@services/index';

export function createLibrary(config: Partial<Config> = {}): {
  config: Config;
  userService: UserService;
} {
  const mergedConfig: Config = { ...DEFAULT_CONFIG, ...config };
  
  return {
    config: mergedConfig,
    userService: new UserService(mergedConfig)
  };
}

export default createLibrary;