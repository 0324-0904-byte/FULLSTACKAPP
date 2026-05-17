import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms';   

@Component({
  selector: 'app-users',
  templateUrl: './users.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class UsersComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef); // Forces UI layouts to register state updates instantly

  isLoggedIn = false;
  loginName = '';
  loginPass = '';
  role = 'User';
  userId: any = null;

  activeTab = 'vault';
  searchText = '';
  selectedFolderId: any = '';
  dbLatency = 14;

  users: any[] = [];
  documents: any[] = [];
  folders: any[] = [];
  logs: any[] = [];

  newFolderName = '';
  newUserName = '';
  newUserPass = '';
  newUserRole = 'User';

  selectedPermUserId = '';
  canViewPerm = false;
  canUploadPerm = false;

  uploadTitle = '';
  uploadCategory = 'General';
  selectedFile: File | null = null;

  editingDoc: any = null;
  editingUser: any = null;
  editingFolder: any = null;

  ngOnInit() {
    if (this.isLoggedIn) {
      this.refresh();
    }
    setInterval(() => {
      this.dbLatency = Math.floor(Math.random() * (22 - 11 + 1)) + 11;
      this.cdr.detectChanges();
    }, 5000);
  }

  refresh() {
    this.fetchFolders();
    this.fetchVaultDocs();
    this.fetchUsers();
    this.fetchLogs();
  }

  login() {
    if (!this.loginName.trim() || !this.loginPass.trim()) return;
    this.http.post('http://localhost:3000/api/login', { name: this.loginName, pass: this.loginPass })
      .subscribe({
        next: (res: any) => {
          this.isLoggedIn = true;
          this.loginName = res.name;
          this.role = res.role;
          this.userId = res.id;
          this.activeTab = this.role === 'Admin' ? 'dashboard' : 'vault';
          this.refresh();
          this.cdr.detectChanges();
        },
        error: () => alert("Access Denied: Check username or password.")
      });
  }

  logout() {
    this.isLoggedIn = false;
    this.loginName = '';
    this.loginPass = '';
    this.role = 'User';
    this.userId = null;
    this.users = [];
    this.documents = [];
    this.folders = [];
    this.logs = [];
    this.cdr.detectChanges();
  }

  fetchVaultDocs() {
    this.http.get(`http://localhost:3000/api/documents?folder_id=${this.selectedFolderId}&search=${this.searchText}`)
      .subscribe((data: any) => {
        this.documents = data;
        this.cdr.detectChanges();
      });
  }

  onFileSelected(event: any) {
    if (event.target.files.length > 0) {
      this.selectedFile = event.target.files[0];
      this.cdr.detectChanges();
    }
  }

  uploadDocument() {
    if (!this.uploadTitle.trim()) {
      alert("Please provide an explicit display name for your resource.");
      return;
    }
    const fb = new FormData();
    if (this.selectedFile) fb.append('file', this.selectedFile);
    fb.append('title', this.uploadTitle);
    fb.append('category', this.uploadCategory);
    fb.append('folder_id', this.selectedFolderId || '');
    fb.append('user_id', this.userId);

    this.http.post('http://localhost:3000/api/upload', fb).subscribe(() => {
      this.uploadTitle = '';
      this.selectedFile = null;
      this.fetchVaultDocs();
      this.cdr.detectChanges();
    });
  }

  startDocEdit(doc: any) {
    this.editingDoc = { ...doc };
    this.cdr.detectChanges();
  }

  saveDocUpdate() {
    if (!this.editingDoc) return;
    const targetFolder = (this.editingDoc.folder_id === 'null' || this.editingDoc.folder_id === '') ? null : this.editingDoc.folder_id;

    this.http.put(`http://localhost:3000/api/documents/${this.editingDoc.id}`, {
      title: this.editingDoc.title,
      category: this.editingDoc.category,
      folder_id: targetFolder,
      user_id: this.userId
    }).subscribe(() => {
      this.editingDoc = null;
      this.refresh();
      this.cdr.detectChanges();
    });
  }

  removeDocument(id: number) {
    if (confirm("Permanently drop and delete this file asset from system server storage?")) {
      this.http.delete(`http://localhost:3000/api/documents/${id}?user_id=${this.userId}`).subscribe(() => {
        this.fetchVaultDocs();
        this.cdr.detectChanges();
      });
    }
  }

  downloadFile(id: number, filename: string) {
    this.http.get(`http://localhost:3000/api/documents/download/${id}`, { responseType: 'blob' })
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
    this.http.get('http://localhost:3000/api/folders').subscribe((data: any) => {
      this.folders = data;
      this.cdr.detectChanges();
    });
  }

  createFolder() {
    if (!this.newFolderName.trim()) return;
    this.http.post('http://localhost:3000/api/folders', {
      folder_name: this.newFolderName,
      user_id: this.userId
    }).subscribe(() => {
      this.newFolderName = '';
      this.fetchFolders();
      this.cdr.detectChanges();
    });
  }

  startFolderRename(f: any) { 
    this.editingFolder = { ...f }; 
    this.cdr.detectChanges();
  }

  saveFolderRename() {
    if (!this.editingFolder || !this.editingFolder.folder_name.trim()) return;
    this.http.put(`http://localhost:3000/api/folders/${this.editingFolder.id}`, {
      folder_name: this.editingFolder.folder_name,
      user_id: this.userId
    }).subscribe(() => {
      this.editingFolder = null;
      this.fetchFolders();
      this.cdr.detectChanges();
    });
  }

  removeFolder(id: any) {
    if (confirm("Delete this folder layout? Managed file rows inside will automatically default back to the open public view.")) {
      this.http.delete(`http://localhost:3000/api/folders/${id}?user_id=${this.userId}`).subscribe(() => {
        this.fetchFolders();
        this.cdr.detectChanges();
      });
    }
  }

  fetchUsers() {
    this.http.get('http://localhost:3000/api/users').subscribe((data: any) => {
      this.users = data;
      this.cdr.detectChanges();
    });
  }

  addUser() {
    if (!this.newUserName.trim() || !this.newUserPass.trim()) return;
    this.http.post('http://localhost:3000/api/users', { 
      name: this.newUserName, 
      password: this.newUserPass, 
      role: this.newUserRole 
    }).subscribe(() => {
      this.ngZoneRunCleanup();
    });
  }

  private ngZoneRunCleanup() {
    this.newUserName = ''; 
    this.newUserPass = '';
    this.newUserRole = 'User';
    this.fetchUsers();
    this.cdr.detectChanges();
  }

  startEdit(user: any) { 
    this.editingUser = { ...user }; 
    this.cdr.detectChanges();
  }

  saveUpdate() {
    if (!this.editingUser) return;
    this.http.put(`http://localhost:3000/api/users/${this.editingUser.id}`, this.editingUser).subscribe(() => { 
      this.editingUser = null; 
      this.fetchUsers(); 
      this.cdr.detectChanges();
    });
  }

  deleteUser(id: number) {
    if (confirm("Are you sure you want to drop this user authorization profile completely?")) {
      this.http.delete(`http://localhost:3000/api/users/${id}`).subscribe(() => {
        this.fetchUsers();
        this.cdr.detectChanges();
      });
    }
  }

  applyFolderPermissions() {
    if (!this.selectedFolderId || !this.selectedPermUserId) {
      alert("Please select both a directory track and user account assignment.");
      return;
    }
    this.http.post('http://localhost:3000/api/permissions', { 
      folder_id: this.selectedFolderId, 
      user_id: this.selectedPermUserId, 
      can_view: this.canViewPerm ? 1 : 0, 
      can_upload: this.canUploadPerm ? 1 : 0 
    }).subscribe(() => {
      alert("Access authorization policies successfully saved.");
      this.canViewPerm = false;
      this.canUploadPerm = false;
      this.cdr.detectChanges();
    });
  }

  fetchLogs() {
    this.http.get('http://localhost:3000/api/logs').subscribe((data: any) => {
      this.logs = data;
      this.cdr.detectChanges();
    });
  }

  cancelEdit() { 
    this.editingDoc = null; 
    this.editingUser = null; 
    this.editingFolder = null; 
    this.cdr.detectChanges();
  }
}