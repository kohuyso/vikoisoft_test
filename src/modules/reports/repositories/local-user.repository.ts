import { Injectable } from '@nestjs/common';
import { LocalUserProfile } from '../entities/user-report.entity.js';

@Injectable()
export class LocalUserRepository {
  private users: LocalUserProfile[] = [
    { id: 1, name: 'Alice', last_login: '2025-10-10' },
    { id: 2, name: 'Bob', last_login: '2025-10-11' },
    { id: 3, name: 'Charlie', last_login: '2025-10-12' },
  ];

  async findAllUsers(): Promise<LocalUserProfile[]> {
    // Simulates an async database query (e.g. SELECT * FROM users)
    return [...this.users];
  }

  async findUserById(id: number): Promise<LocalUserProfile | null> {
    const user = this.users.find((u) => u.id === id);
    return user ? { ...user } : null;
  }
}
