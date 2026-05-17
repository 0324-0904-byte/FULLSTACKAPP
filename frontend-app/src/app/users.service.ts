import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api';
  
  getUsers(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}/users`); }
  addUser(payload: any): Observable<any> { return this.http.post(`${this.apiUrl}/add-user`, payload); }
  updateUser(id: number, userData: any): Observable<any> { return this.http.put(`${this.apiUrl}/update-user/${id}`, userData); }
  deleteUser(id: number): Observable<any> { return this.http.delete(`${this.apiUrl}/delete-user/${id}`); }

  getFolders(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}/folders`); }
  addFolder(name: string, parentId: number | null = null): Observable<any> { 
    return this.http.post(`${this.apiUrl}/folders`, { name, parent_id: parentId }); 
  }
  renameFolder(id: number, name: string): Observable<any> { return this.http.put(`${this.apiUrl}/folders/${id}`, { folder_name: name }); }
  deleteFolder(id: number): Observable<any> { return this.http.delete(`${this.apiUrl}/folders/${id}`); }

  updateFolderPermissions(folderId: number, userId: number, canView: boolean, canUpload: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/folders/permissions`, { folder_id: folderId, user_id: userId, can_view: canView, can_upload: canUpload });
  }

  // FIXED PARAMETER ORDERING TO ELIMINATE TS2345 STR/NUM MISMATCH
  getDocuments(search: string, folderId: any, userId: number = 1): Observable<any[]> {
    const filter = folderId ? `&folderId=${folderId}` : '';
    return this.http.get<any[]>(`${this.apiUrl}/documents/secure/${userId}?search=${search}${filter}`);
  }
  
  uploadDocument(formData: FormData): Observable<any> { return this.http.post(`${this.apiUrl}/upload`, formData); }
  updateDocument(id: number, data: any): Observable<any> { return this.http.put(`${this.apiUrl}/documents/${id}`, data); }
  deleteDocument(id: number): Observable<any> { return this.http.delete(`${this.apiUrl}/documents/${id}`); }
  getLogs(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}/logs`); }
}