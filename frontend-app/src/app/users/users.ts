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

  editingDoc: any = null;
  editingFolder: any = null;

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

    // ADMIN-ONLY DATA FETCHING
    if (this.role === 'admin') {
      this.http.get<any[]>('http://localhost:3000/users/', { headers }).subscribe(d => {
        this.user = [...d];
        
        // Calculate Real Latency based on DB response time
        this.dbLatency = Date.now() - startTime;
        
        this.cdr.detectChanges(); 
      });

      this.http.get<any[]>('http://localhost:3000/logs', { headers }).subscribe(d => {
        this.logs = [...d];
        this.cdr.detectChanges();
      });
    } else {
      // Regular users don't fetch user/log lists, but we can still show a fast UI latency baseline
      this.dbLatency = Date.now() - startTime;
    }

    // 🔓 GLOBAL DATA FETCHING (Everyone has access to these)
    this.http.get<any[]>('http://localhost:3000/folders', { headers }).subscribe(d => {
      this.folder = [...d];
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

  onFileSelected(event: any) { 
    this.selectedFile = event.target.files[0]; 
  }

  uploadDocument() {
    if (!this.uploadTitle.trim()) {
      alert("Please provide an explicit display name for your resource.");
      return;
    }

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    const fb = new FormData();
    if (this.selectedFile) fb.append('file', this.selectedFile);
    fb.append('title', this.uploadTitle);
    fb.append('folder_id', this.selectedFolderId || '');
    fb.append('user_id', this.currentUserId);

    this.http.post<any>('http://localhost:3000/upload', fb, { headers }).subscribe({
      next: (res) => {
        this.uploadTitle = '';
        this.selectedFile = null;
        this.fetchVaultDocs();
        this.cdr.detectChanges();
        alert("Document uploaded successfully!");
      },
      error: (err) => {
        console.error(err);
        alert("Upload failed.");
      }
    });
  }

  startDocEdit(doc: any) {
    this.editingDoc = { ...doc };
    this.cdr.detectChanges();
  }

  cancelDocEdit() {
    this.editingDoc = null;
    this.cdr.detectChanges();
  }

  saveDocUpdate() {
    if (!this.editingDoc) return;
    const targetFolder = (this.editingDoc.folder_id === 'null' || this.editingDoc.folder_id === '') ? null : this.editingDoc.folder_id;

    this.http.put(`http://localhost:3000/documents/${this.editingDoc.id}`, {
      folder_name: this.editingDoc.title,
      folder_id: targetFolder,
      user_id: this.currentUserId 
    }).subscribe(() => {
      this.editingDoc = null;
      this.refresh();
      this.cdr.detectChanges();
    });
  }

  removeDocument(id: number) {
    if (confirm("Permanently drop and delete this file asset from system server storage?")) {
      this.http.delete(`http://localhost:3000/documents/${id}?user_id=${this.currentUserId}`).subscribe(() => {
        this.fetchVaultDocs();
        this.cdr.detectChanges();
      });
    }
  }

  downloadFile(id: number, filename: string) {
    this.http.get(`http://localhost:3000/documents/download/${id}`, { responseType: 'blob' })
      .subscribe((blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        this.cdr.detectChanges();
      });
  }

  fetchFolders() {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    this.http.get<any[]>('http://localhost:3000/folders', { headers }).subscribe({
      next: (data) => {
        this.folder = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Failed to fetch folders:", err);
        alert("Error fetching folders: " + (err.error?.error || "Unauthorized"));
      }
    });
  }

  createFolder() {
    if (!this.newFolderName || !this.newFolderName.trim()) {
      alert("Please enter a folder name.");
      return;
    }

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    const payload = {
      folder_name: this.newFolderName.trim()
    };

    this.http.post<any>('http://localhost:3000/folders', payload, { headers }).subscribe({
      next: (res) => {
        this.newFolderName = ''; 
        this.fetchFolders();   
        this.cdr.detectChanges();
        alert("Folder created successfully!");
      },
      error: (err) => {
        console.error(err);
        alert("Failed to create folder: " + (err.error?.message || err.error?.error || "Unauthorized or Server Error"));
      }
    });
  }

  startFolderRename(f: any) { 
    this.editingFolder = { ...f }; 
    this.cdr.detectChanges();
  }

  saveFolderRename() {
    if (!this.editingFolder || !this.editingFolder.folder_name.trim()) return;
    this.http.put(`http://localhost:3000/folders/${this.editingFolder.id}`, {
      folder_name: this.editingFolder.folder_name,
      user_id: this.currentUserId
    }).subscribe(() => {
      this.editingFolder = null;
      this.fetchFolders();
      this.cdr.detectChanges();
    });
  }

  removeFolder(id: any) {
    if (confirm("Delete this folder layout? Managed file rows inside will automatically default back to the open public view.")) {
      this.http.delete(`http://localhost:3000/folders/${id}?user_id=${this.currentUserId}`).subscribe(() => {
        this.fetchFolders();
        this.cdr.detectChanges();
      });
    }
  }

  // LOGOUT and save to logs (logout-history)
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