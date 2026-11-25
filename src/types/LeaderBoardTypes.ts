export const ANONYMOUS_PROFILE_IMAGES = [
  'assets/img/profiles/alligator.svg',
  'assets/img/profiles/anaconda.svg',
  'assets/img/profiles/capybara.svg',
  'assets/img/profiles/cat.svg',
  'assets/img/profiles/dog.svg',
  'assets/img/profiles/eagle.svg',
  'assets/img/profiles/lion.svg',
  'assets/img/profiles/panda.svg',
  'assets/img/profiles/tapir.svg',
  'assets/img/profiles/tiger.svg',
  'assets/img/profiles/titi-monkey.svg',
];

export interface UserLeaderType {
  isAnonymous: boolean;
  displayName: string;
  photoURL: string;
  // Available only when isAnonymous is false
  uid?: string;
  email?: string;
}

export interface LeaderEntryType {
  id?: string;
  user: UserLeaderType;
  roomId: string;
  points: number;
  // epoch
  updated: number;
  created: number;
}
