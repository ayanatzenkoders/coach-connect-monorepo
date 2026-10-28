import { apiRequest } from '@/src/service/setup/apiClient';
import { authApi } from '@/src/service/api/auth.api';

jest.mock('@/src/service/setup/apiClient', () => ({ apiRequest: jest.fn().mockResolvedValue({}) }));
const call = apiRequest as jest.Mock;

describe('authApi', () => {
  beforeEach(() => call.mockClear());

  it('login posts email, password and device to /auth/login', async () => {
    const input = { email: 'a@b.co', password: 'pw', deviceId: 'device-12345678' };
    await authApi.login(input);
    expect(call).toHaveBeenCalledWith('/auth/login', { method: 'POST', body: input });
  });

  it('register posts name too', async () => {
    const input = { email: 'a@b.co', password: 'pw', name: 'Ana', dateOfBirth: '1990-05-17', deviceId: 'device-12345678' };
    await authApi.register(input);
    expect(call).toHaveBeenCalledWith('/auth/register', { method: 'POST', body: input });
  });

  it('registerCoach posts the application to its own route', async () => {
    const input = { email: 'c@b.co', password: 'pw', name: 'Carl', dateOfBirth: '1985-03-09', phone: '+49 170 1234567', bio: 'I help people with career talks.', specialties: ['Burnout'], deviceId: 'device-12345678' };
    await authApi.registerCoach(input);
    expect(call).toHaveBeenCalledWith('/auth/register-coach', { method: 'POST', body: input });
  });

  it('refresh sends only the refresh token, without an access token', async () => {
    await authApi.refresh('sid.secret');
    expect(call).toHaveBeenCalledWith('/auth/refresh', { method: 'POST', body: { refreshToken: 'sid.secret' } });
  });

  it('logout and me send the access token', async () => {
    await authApi.logout('tok');
    expect(call).toHaveBeenCalledWith('/auth/logout', { method: 'POST', accessToken: 'tok' });
    await authApi.me('tok');
    expect(call).toHaveBeenCalledWith('/auth/me', { accessToken: 'tok' });
  });
});
