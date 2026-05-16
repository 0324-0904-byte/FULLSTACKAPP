import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  // This is the URL of your Node.js backend running on your HP EliteBook
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) { }

  // GET: Fetch all active users
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }

  // POST: Add a new user
  addUser(name: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/add-user`, { name });
  }

  // PUT: Update an existing user's name
  updateUser(id: number, name: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/update-user/${id}`, { name });
  }

  // PUT: Soft delete (Status change to Inactive)
  disableUser(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/disable-user/${id}`, {});
  }
}