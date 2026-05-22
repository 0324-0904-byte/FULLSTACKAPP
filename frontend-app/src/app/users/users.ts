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
  activeLogId: any = null;

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
      this.activeLogId = res.activeLogId;

      if (res.token) {
        localStorage.setItem('token', res.token);
      }
      console.log("hi", res)

      // DYNAMIC REDIRECT BASED ON THE RESPONSED ROLE
      if (this.role === 'admin') {
        this.activeTab = 'dashboard';
      } else {
        this.activeTab = 'vault'; // Send regular users straight to the Documents vault
      }

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
          alert("Server Error: Could not create account." + err.status);
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

    const updatePayload = {
      username: this.editingUser.username,
      role: this.editingUser.role,
      status: this.editingUser.status 
    };

    this.http.put<any>(`http://localhost:3000/users/${this.editingUser.id}`, updatePayload, { headers }).subscribe({
      next: (res) => {
        if (res.success) {
          this.editingUser = null; 
          this.refresh(); 
          alert("Update Success!");
        } else {
          alert("Update failed: " + res.message);
        }
      },
      error: (err) => {
        alert("Communication Error: " + (err.error?.message || "Could not save."));
      }
    });
  }

  toggleStatus(userId: number, currentStatus: 'active' | 'deactivated') {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    
    const nextStatus = currentStatus === 'active' ? 'deactivated' : 'active';

    this.http.put<any>(`http://localhost:3000/users/status/${userId}`, { status: nextStatus }, { headers }).subscribe({
      next: (res) => {
        this.refresh(); 
      },
      error: (err) => {
        alert(`Could not change user status.`);
      }
    });
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
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    this.http.post<any>('http://localhost:3000/auth/logout', { activeLogId: this.activeLogId }, { headers }).subscribe({
      next: () => {
        this.isLoggedIn = false; 
        this.loginName = '';
        this.loginPass = ''; 
        this.role = '';
        this.currentUserId = null;
        this.activeLogId = null;
        localStorage.removeItem('token');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Failed to record logout stamp gracefully:", err);
        
        this.isLoggedIn = false; 
        this.loginName = '';
        this.loginPass = ''; 
        this.role = '';
        this.currentUserId = null;
        this.activeLogId = null;
        localStorage.removeItem('token');
        this.cdr.detectChanges();
      }
    });
  }
}