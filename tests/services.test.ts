import { UserService } from '@services/index';
import { UserRole } from '@types/index';
import * as utils from '@utils/index';

describe('UserService', () => {
  jest.spyOn(utils, 'delay').mockImplementation(() => Promise.resolve());
  
  describe('getUserById', () => {
    it('should return a user with the given id', async () => {
      const service = new UserService();
      const userId = '123';
      
      const user = await service.getUserById(userId);
      
      expect(user).not.toBeNull();
      expect(user?.id).toBe(userId);
      expect(user?.role).toBe(UserRole.USER);
    });
    
    it('should return null when an error occurs', async () => {
      const service = new UserService();
      
      jest.spyOn(utils, 'delay').mockImplementationOnce(() => {
        throw new Error('Network error');
      });
      
      const user = await service.getUserById('123');
      
      expect(user).toBeNull();
    });
  });
  
  describe('updateUser', () => {
    it('should return true when update is successful', async () => {
      const service = new UserService();
      const user = {
        id: '123',
        name: 'Updated Name'
      };
      
      const consoleSpy = jest.spyOn(console, 'log');
      
      const result = await service.updateUser(user);
      
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(`User updated: ${user.id}`);
      
      consoleSpy.mockRestore();
    });
    
    it('should return false when an error occurs', async () => {
      const service = new UserService();
      
      jest.spyOn(utils, 'delay').mockImplementationOnce(() => {
        throw new Error('Network error');
      });
      
      const result = await service.updateUser({ id: '123', name: 'Test' });
      
      expect(result).toBe(false);
    });
  });
});