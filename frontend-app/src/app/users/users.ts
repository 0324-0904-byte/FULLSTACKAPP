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
  users: any[] = [];
  documents: any[] = [];
  folders: any[] = [];
  logs: any[] = [];

  // --- UI & Navigation State ---
  activeTab = 'dashboard';
  searchText = '';
  newFolderName = '';
  selectedFolderId: any = '';
  newUserName = '';
  newUserRole = 'User';
  newUserPass = '';

  // --- Edit State ---
  editingUser: any = null;

  // --- Real Stats Feature ---
  dbLatency: number = 0; // Tracking real connection speed

  uploadTitle = '';
  uploadCategory = 'General';
  selectedFile: File | null = null;

  ngOnInit() {}

  // REAL-TIME SYNC ENGINE
  refresh() {
    const startTime = Date.now(); // Start timer for real latency

    this.http.get<any[]>('http://localhost:3000/users/').subscribe(d => {
      this.users = [...d];
      
      // Calculate Real Latency based on DB response time
      this.dbLatency = Date.now() - startTime;
      
      this.cdr.detectChanges(); 
    });
    this.http.get<any[]>('http://localhost:3000/folders').subscribe(d => {
      this.folders = [...d];
      this.cdr.detectChanges();
    });
    this.http.get<any[]>('http://localhost:3000/logs').subscribe(d => {
      this.logs = [...d];
      this.cdr.detectChanges();
    });
    this.fetchVaultDocs();
  }

  login() {
    this.http.post<any>('http://localhost:3000/auth/login', { name: this.loginName, password: this.loginPass }).subscribe(res => {
      if (res.success) {
        this.isLoggedIn = true;
        this.role = res.role;
        this.currentUserId = res.id;
        // LOAD ANALYTICS DATA IMMEDIATELY ON LOGIN
        this.refresh();
      } else alert(res.message);
    });
  }

  // --- USER MANAGEMENT (UPDATED WITH DIALOGUES) ---
  addUser() {
    if (!this.newUserName || !this.newUserPass) return alert("Fill Name and Password");
    const payload = { name: this.newUserName, role: this.newUserRole, password: this.newUserPass };
    
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

    console.log("SENDING UPDATE FOR:", this.editingUser);

    this.http.put<any>(`http://localhost:3000/users/${this.editingUser.id}`, this.editingUser).subscribe({
      next: (res) => {
        if (res.success) {
          this.editingUser = null; // Exit Edit Mode
          this.refresh(); // Sync UI with Database
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

  deleteUser(userId: number) {
    if (confirm("Permanently delete this account?")) {
      this.users = this.users.filter(u => u.id !== userId);
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
    const url = `http://localhost:3000/documents?search=${this.searchText}${filter}`;
    this.http.get<any[]>(url).subscribe(d => {
      this.documents = [...d];
      this.cdr.detectChanges();
    });
  }

  createFolder() {
    if (!this.newFolderName) return;
    this.http.post<any>('http://localhost:3000/folders', { name: this.newFolderName }).subscribe(() => {
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
    fb.append('category', this.uploadCategory);
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