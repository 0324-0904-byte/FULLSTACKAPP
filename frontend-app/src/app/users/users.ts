import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrls: ['./users.css'] 
})
export class UsersComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  // --- Session State ---
  isLoggedIn = false;
  role = '';
  loginName = '';
  loginPass = '';
  currentUserId: any = null;

  // --- Data Repositories ---
  user: any[] = [];
  document: any[] = [];
  folder: any[] = [];
  logs: any[] = [];

  // --- UI & Navigation State ---
  activeTab = 'dashboard';
  searchText = '';
  newFolderName = '';
  selectedFolderId: any = '';
  newUserName = '';
  newUserRole = 'user';
  newUserPass = '';

  // --- Edit State ---
  editingUser: any = null;

  // --- Real Stats Feature ---
  dbLatency: number = 0; // Tracking real connection speed

  uploadTitle = '';
  uploadCategory = 'General';
  selectedFile: File | null = null;

  ngOnInit() {}


  login() {
    this.http.post<any>('http://localhost:3000/auth/login', { name: this.loginName, password: this.loginPass }).subscribe(res => {
       if (res.success) {
        this.isLoggedIn = true;
        this.role = res.user.role;
        this.currentUserId = res.user.id;

        if (res.token) {
          localStorage.setItem('token', res.token);
        }
        console.log("hi", res)
        // LOAD ANALYTICS DATA IMMEDIATELY ON LOGIN
        this.refresh();
      } else alert(res.message);
    });
  }


  // REAL-TIME SYNC ENGINE
  refresh() {
    const startTime = Date.now(); // Start timer for real latency

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    this.http.get<any[]>('http://localhost:3000/users/', { headers }).subscribe(d => {
      this.user = [...d];
      
      // Calculate Real Latency based on DB response time
      this.dbLatency = Date.now() - startTime;
      
      this.cdr.detectChanges(); 
    });
    this.http.get<any[]>('http://localhost:3000/folders', { headers }).subscribe(d => {
      this.folder = [...d];
      this.cdr.detectChanges();
    });
    this.http.get<any[]>('http://localhost:3000/logs', { headers }).subscribe(d => {
      this.logs = [...d];
      this.cdr.detectChanges();
    });
    this.fetchVaultDocs();
  }


  // --- USER MANAGEMENT (UPDATED WITH DIALOGUES) ---
  addUser() {
    if (!this.newUserName || !this.newUserPass) return alert("Fill Name and Password");
    const payload = { username: this.newUserName, role: this.newUserRole, password: this.newUserPass };
    
    this.http.post<any>('http://localhost:3000/auth/register', payload).subscribe({
      next: (res) => {
        // SUCCESS DIALOGUE
        alert("Successfully created account");
        this.newUserName = '';
        this.newUserPass = '';
        this.refresh();
      },
      error: (err) => {
        // ERROR DIALOGUES
        if (err.status === 400) {
          alert("User is already registered");
        } else {
          alert("Server Error: Could not create account.");
        }
        this.refresh();
      }
    });
  }

  // --- EDITING LOGIC (REINFORCED SAVE) ---
  startEdit(user: any) {
    this.editingUser = { ...user };
    this.cdr.detectChanges();
  }

  cancelEdit() {
    this.editingUser = null;
    this.cdr.detectChanges();
  }

  saveUpdate() {
    if (!this.editingUser || !this.editingUser.id) {
        alert("Error: Critical User ID missing for update.");
        return;
    }

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    console.log("SENDING UPDATE FOR:", this.editingUser);

    this.http.put<any>(`http://localhost:3000/users/${this.editingUser.id}`, this.editingUser, { headers }).subscribe({
      next: (res) => {
        if (res.success) {
          this.editingUser = null; // Exit Edit Mode
          this.refresh(); // Sync UI with Database
          alert("Update Success!")
        } else {
          alert("Update failed on server: " + res.message);
        }
      },
      error: (err) => {
        console.error("Save Error:", err);
        alert("Communication Error: Could not save changes.");
      }
    });
  }

  toggleStatus(userId: number, action: 'activate' | 'deactivate') {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    // Hits either http://localhost:3000/users/activate/:id or /deactivate/:id
    this.http.put<any>(`http://localhost:3000/users/${action}/${userId}`, {}, { headers }).subscribe({
      next: (res) => {
        this.refresh(); // Sync layout immediately
      },
      error: (err) => {
        console.error(`Failed to ${action} user:`, err);
        alert(`Could not change user status. (Error ${err.status})`);
      }
    });
  }

  deleteUser(userId: number) {
    if (confirm("Permanently delete this account?")) {
      this.user = this.user.filter(u => u.id !== userId);
      this.cdr.detectChanges();
      this.http.delete<any>(`http://localhost:3000/users/${userId}`).subscribe({
        next: () => setTimeout(() => this.refresh(), 300),
        error: () => this.refresh() 
      });
    }
  }

  // --- VAULT & FOLDERS ---
  fetchVaultDocs() {
    const filter = this.selectedFolderId ? `&folderId=${this.selectedFolderId}` : '';
    const url = `http://localhost:3000/document?search=${this.searchText}${filter}`;
    this.http.get<any[]>(url).subscribe(d => {
      this.document = [...d];
      this.cdr.detectChanges();
    });
  }

  createFolder() {
    if (!this.newFolderName) return;
    this.http.post<any>('http://localhost:3000/folder', { name: this.newFolderName }).subscribe(() => {
      this.newFolderName = '';
      setTimeout(() => this.refresh(), 300);
    });
  }

  onFileSelected(event: any) { this.selectedFile = event.target.files[0]; }

  uploadDocument() {
    if (!this.selectedFile || !this.uploadTitle) return;
    const fb = new FormData();
    fb.append('file', this.selectedFile);
    fb.append('title', this.uploadTitle);
    fb.append('folder_id', this.selectedFolderId);
    fb.append('uploaded_by', this.currentUserId);
    this.http.post<any>('http://localhost:3000/upload', fb).subscribe(() => {
      this.uploadTitle = '';
      setTimeout(() => this.refresh(), 400);
    });
  }

  logout() { 
    this.isLoggedIn = false; 
    this.loginPass = ''; 
    this.cdr.detectChanges();
  }
}