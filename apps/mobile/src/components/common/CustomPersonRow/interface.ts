import type { Person } from '@/src/service/api/people.api';

export interface CustomPersonRowProps {
  person: Person;
  onMessage: (person: Person) => void;
  onCall: (person: Person) => void;
}
