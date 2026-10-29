export type AccountProfile = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
};

export type AccountDeviceSession = {
  id: string;
  current: boolean;
  device: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  remembered: boolean;
};
