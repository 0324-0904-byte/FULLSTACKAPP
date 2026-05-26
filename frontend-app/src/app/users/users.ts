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
  userEmail = '';

  // --- PASSWORD VALIDATION ---
  passwordError = '';

  // --- PROFILE FORM STATE ---
  isEditingProfile = false;
  selectedAvatarFile: File | null = null;
  
  profileData = {
    username: '',
    email: '',
    bio: '',
    password: '',
    profile_pic: ''
  };

  profileBackupData = {
    username: '',
    email: '',
    bio: '',
    password: '',
    profile_pic: ''
  };

  // --- Edit State ---
  editingUser: any = null;

  // --- Real Stats Feature ---
  dbLatency: number = 0;

  uploadTitle = '';
  uploadCategory = 'General';
  selectedFile: File | null = null;

  editingDoc: any = null;
  editingFolder: any = null;
  
  // --- Deletion Choice UI State ---
  folderToDelete: any = null;

  ngOnInit() {}

  login() {
    this.http.post<any>('http://localhost:3000/auth/login', {
      name: this.loginName,
      password: this.loginPass
    }).subscribe({
      next: (res: any) => { 
        if (res.success) {
          this.isLoggedIn = true;
          this.role = res.user.role;
          this.currentUserId = res.user.id;
          this.activeLogId = res.activeLogId;
          this.activeTab = 'documents';

          this.profileData.username = res.user.username || res.user.name || this.loginName;
          this.profileData.email = res.user.email || '';
          this.profileData.bio = res.user.bio || '';
          this.profileData.profile_pic = res.user.profile_pic || '';
          this.profileData.password = '';
          this.isEditingProfile = false;

          if (res.token) {
            localStorage.setItem('token', res.token);
          }

          console.log("hi", res);

          if (this.role === 'admin') {
            this.activeTab = 'dashboard';
          } else {
            this.activeTab = 'vault';
          }

          this.refresh();

        } else {
          alert(res.message);
        }
      },
      error: (err: any) => { 
        console.error("Login endpoint failed:", err);
        alert(`Login Connection Error (${err.status}): ${err.message || 'Cannot connect to backend server.'}`);
      }
    });
  }

  refresh() {
    const startTime = Date.now();
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    this.http.get<any>('http://localhost:3000/profile/me', { headers }).subscribe({
      next: (res: any) => { 
        if (res.success && res.user) {
          this.profileData.username = res.user.username || this.loginName;
          this.profileData.email = res.user.email || '';
          this.profileData.bio = res.user.bio || '';
          this.profileData.profile_pic = res.user.profile_pic || '';
          this.profileData.password = '';
          this.profileBackupData = { ...this.profileData };
          this.cdr.detectChanges();
        }
      },
      error: (err: any) => console.error("Fetch current profile status failed:", err) 
    });

    if (this.role === 'admin') {
      this.http.get<any[]>('http://localhost:3000/users/', { headers }).subscribe({
        next: (d: any[]) => { 
          this.user = [...d];
          this.dbLatency = Date.now() - startTime;
          this.cdr.detectChanges();
        },
        error: (err: any) => console.error("Admin fetch users failed:", err) 
      });

      this.http.get<any[]>('http://localhost:3000/logs', { headers }).subscribe({
        next: (d: any[]) => { 
          this.logs = [...d];
          this.cdr.detectChanges();
        },
        error: (err: any) => console.error("Admin fetch logs failed:", err) 
      });
    } else {
      this.dbLatency = Date.now() - startTime;
    }

    this.http.get<any[]>('http://localhost:3000/folders', { headers }).subscribe({
      next: (d: any[]) => { 
        this.folder = [...d];
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error("Fetch folders failed:", err) 
    });

    this.fetchVaultDocs();
  }

  addUser() {
    if (!this.newUserPass || this.newUserPass.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
    }

    if (!this.newUserName || !this.newUserPass) {
      return alert("Fill Name and Password");
    }

    const payload = {
      name: this.newUserName,
      role: this.newUserRole,
      password: this.newUserPass
    };
    
    this.http.post<any>('http://localhost:3000/auth/register', payload).subscribe({
      next: (res: any) => { 
        alert("Successfully created account");
        this.newUserName = '';
        this.newUserPass = '';
        this.refresh();
      },
      error: (err: any) => { 
        if (err.status === 400) {
          alert("User is already registered");
        } else {
          alert("Server Error: Could not create account. Status: " + err.status);
        }
        this.refresh();
      }
    });
  }

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

    this.http.put<any>(
      `http://localhost:3000/users/${this.editingUser.id}`,
      updatePayload,
      { headers }
    ).subscribe({
      next: (res: any) => { 
        if (res.success) {
          this.editingUser = null;
          this.refresh();
          alert("Update Success!");
        } else {
          alert("Update failed: " + res.message);
        }
      },
      error: (err: any) => { 
        alert("Communication Error: " + (err.error?.message || `Could not save. Status: ${err.status}`));
      }
    });
  }

  toggleStatus(userId: number, currentStatus: 'active' | 'deactivated') {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    
    const nextStatus = currentStatus === 'active' ? 'deactivated' : 'active';

    this.http.put<any>(
      `http://localhost:3000/users/status/${userId}`,
      { status: nextStatus },
      { headers }
    ).subscribe({
      next: (res: any) => { 
        this.refresh();
      },
      error: (err: any) => { 
        alert(`Could not change user status. Status: ${err.status}`);
      }
    });
  }

  fetchVaultDocs() {
    const filter = this.selectedFolderId ? `&folderId=${this.selectedFolderId}` : '';
    const url = `http://localhost:3000/document?search=${this.searchText}${filter}`;
    const token = localStorage.getItem('token');
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.http.get<any[]>(url, { headers }).subscribe({
      next: (d: any[]) => { 
        this.document = [...d];
        this.cdr.detectChanges();
      },
      error: (err: any) => { 
        console.error("Fetch documents failed:", err);
      }
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

    if (this.selectedFile) {
      fb.append('file', this.selectedFile);
    }

    fb.append('title', this.uploadTitle);
    fb.append('folder_id', this.selectedFolderId || '');
    fb.append('uploaded_by', this.currentUserId);

    this.http.post<any>(
      'http://localhost:3000/upload',
      fb,
      { headers }
    ).subscribe({
      next: (res: any) => { 
        this.uploadTitle = '';
        this.selectedFile = null;
        this.fetchVaultDocs();
        this.cdr.detectChanges();
        alert("Document uploaded successfully!");
      },
      error: (err: any) => { 
        console.error(err);
        alert(`Upload failed. Server responded with status: ${err.status}`);
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
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` }; // FIXED: Added Auth Header

    this.http.put(
      `http://localhost:3000/document/${this.editingDoc.id}`,
      {
        title: this.editingDoc.title,
        folder_id: targetFolder,
        uploaded_by: this.currentUserId
      },
      { headers }
    ).subscribe({
      next: () => {
        this.editingDoc = null;
        this.refresh();
        this.cdr.detectChanges();
        alert("Document updated successfully!");
      },
      error: (err: any) => { 
        console.error(err);
        alert(`Failed to update document. Status: ${err.status}`);
      }
    });
  }

  removeDocument(id: number) {
    if (confirm("Permanently delete this file from system server storage?")) {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` }; // FIXED: Added Auth Header

      this.http.delete(
        `http://localhost:3000/document/${id}?uploaded_by=${this.currentUserId}`,
        { headers }
      ).subscribe({
        next: () => {
          alert("Document deleted successfully!");
          this.fetchVaultDocs();
          this.cdr.detectChanges();
        },
        error: (err: any) => { 
          console.error(err);
          alert(`Failed to delete document. Status: ${err.status}`);
        }
      });
    }
  }

  downloadFile(id: number, filename: string) {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` }; // FIXED: Added Auth Header

    this.http.get(
      `http://localhost:3000/document/download/${id}`,
      {
        responseType: 'blob',
        headers: headers
      }
    ).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        this.cdr.detectChanges();
      },
      error: (err: any) => { 
        console.error(err);
        alert(`Download failed. Status: ${err.status}`);
      }
    });
  }

  fetchFolders() {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    this.http.get<any[]>(
      'http://localhost:3000/folders',
      { headers }
    ).subscribe({
      next: (data: any[]) => { 
        this.folder = data;
        this.cdr.detectChanges();
      },
      error: (err: any) => { 
        console.error("Failed to fetch folders:", err);
        alert("Error fetching folders: " + (err.error?.error || `Unauthorized or Status ${err.status}`));
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
    const payload = { folder_name: this.newFolderName.trim() };

    this.http.post<any>(
      'http://localhost:3000/folders',
      payload,
      { headers }
    ).subscribe({
      next: (res: any) => { 
        this.newFolderName = '';
        this.fetchFolders();
        this.cdr.detectChanges();
        alert("Folder created successfully!");
      },
      error: (err: any) => { 
        console.error(err);
        alert("Failed to create folder: " + (err.error?.message || err.error?.error || `Status: ${err.status}`));
      }
    });
  }

  startFolderRename(f: any) {
    this.editingFolder = { ...f };
    this.cdr.detectChanges();
  }

  cancelFolderRename() {
    this.editingFolder = null;
    this.cdr.detectChanges();
  }

  saveFolderRename() {
    if (!this.editingFolder || !this.editingFolder.folder_name.trim()) return;

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    this.http.put(
      `http://localhost:3000/folders/${this.editingFolder.id}`,
      {
        folder_name: this.editingFolder.folder_name,
        user_id: this.currentUserId
      },
      { headers }
    ).subscribe({
      next: () => {
        alert("Folder renamed successfully!");
        this.editingFolder = null;
        this.fetchFolders();
        this.cdr.detectChanges();
      },
      error: (err: any) => { 
        console.error(err);
        alert(`Rename failed. Status: ${err.status}`);
      }
    });
  }

  confirmDelete(folder: any) {
    this.folderToDelete = folder;
  }

  performDelete(isCascade: boolean) {
    if (!this.folderToDelete) return;

    const id = this.folderToDelete.id;
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    // FIXED: Changed malformed base URL 'http://folders' to explicit local proxy origin
    this.http.delete(
      `http://localhost:3000/folders/${id}?cascade=${isCascade}`,
      { headers }
    ).subscribe({
      next: () => {
        this.folderToDelete = null;
        this.fetchFolders();
        this.fetchVaultDocs();
        this.cdr.detectChanges();

        alert(
          isCascade
            ? "Folder and all documents deleted."
            : "Folder deleted, documents moved to Global."
        );
      },
      error: (err: any) => { 
        this.folderToDelete = null;
        console.error("Delete failed:", err);
        alert("Failed to delete folder: " + (err.error?.message || `Unauthorized or Status ${err.status}`));
      }
    });
  }

  toggleProfileEdit(editState: boolean) {
    this.isEditingProfile = editState;

    if (editState) {
      this.profileBackupData = { ...this.profileData };
    } else {
      this.profileData = { ...this.profileBackupData };
      this.profileData.password = '';
    }

    this.cdr.detectChanges();
  }

  // Event listener to capture the user's selected profile picture
  onAvatarSelected(event: any) {
    if (event.target.files && event.target.files[0]) {
      this.selectedAvatarFile = event.target.files[0];
      this.cdr.detectChanges();
    }
  }

  updateProfile() {
    if (!this.currentUserId) {
      alert("Error: Critical session expiration. Please re-login.");
      return;
    }

    if (this.profileData.password && this.profileData.password.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
    }

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    const fb = new FormData();
    fb.append('userId', this.currentUserId);
    fb.append('username', this.profileData.username);
    fb.append('email', this.profileData.email);
    fb.append('bio', this.profileData.bio);
    
    if (this.profileData.password) {
      fb.append('password', this.profileData.password);
    }

    if (this.selectedAvatarFile) {
      fb.append('profilePic', this.selectedAvatarFile);
    }

    console.log("Transmitting multipart profile payload to API...");

    this.http.put<any>(
      'http://localhost:3000/profile/update-profile',
      fb,
      { headers }
    ).subscribe({
      next: (res: any) => { 
        if (res.success) {
          alert("Profile and data fields locked into DB successfully!");
          this.isEditingProfile = false;
          this.selectedAvatarFile = null; 
          
          // Capture the new file string returned from the backend response!
          if (res.profile_pic) {
            this.profileData.profile_pic = res.profile_pic;
          }
          
          this.loginName = this.profileData.username;
          this.profileData.email = this.profileData.email;
          this.profileData.bio = this.profileData.bio;
          this.profileData.password = '';
          this.profileBackupData = { ...this.profileData };

          // Force-sync layout refresh
          this.refresh();
        } else {
          alert("Database rejection: " + res.message);
        }
      },
      error: (err: any) => { 
        console.error("HTTP Pipe Error during profile patch:", err);
        alert(`HTTP Error ${err.status}: ${err.error?.message || 'Check backend query execution logs.'}`);
      }
    });
  }

  logout() {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    this.http.post<any>(
      'http://localhost:3000/auth/logout',
      { activeLogId: this.activeLogId },
      { headers }
    ).subscribe({
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
      error: (err: any) => { 
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