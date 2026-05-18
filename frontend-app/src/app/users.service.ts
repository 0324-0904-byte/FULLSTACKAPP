import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) { }

  // GET: Fetch all users
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }

  // POST: Add a new user
  addUser(name: string, role: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, { name, role, password });
  }

  // PUT: Update an existing user
  updateUser(id: number, name: string, role: string, status: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${id}`, { name, role, status });
  }

  // DELETE: Permanently delete a user
  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${id}`);
  }
}