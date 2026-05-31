import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http'; 
import Swal from 'sweetalert2'; 

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
  totalDocumentsCount: number = 0;

  uploadTitle = '';
  uploadCategory = 'General';
  selectedFile: File | null = null;

  editingDoc: any = null;
  editingFolder: any = null;
  
  // --- Deletion Choice UI State ---
  folderToDelete: any = null;

  isMobileMenuOpen: boolean = false;

  ngOnInit() {
    const token = sessionStorage.getItem('token');
    
    if (token) {
      this.isLoggedIn = true;
      
      const headers = { 'Authorization': `Bearer ${token}` };
      this.http.get<any>('http://localhost:3000/profile/me', { headers }).subscribe({
        next: (res: any) => {
          if (res.success && res.user) {
            this.role = res.user.role;
            this.currentUserId = res.user.id;
            this.loginName = res.user.username || res.user.name;

            const savedLogId = sessionStorage.getItem('activeLogId');
            if (savedLogId) {
              this.activeLogId = Number(savedLogId);
            }
            
            const savedTab = sessionStorage.getItem('lastTab');
            console.log("Found saved tab on refresh:", savedTab); 
            
            if (savedTab) {
              this.activeTab = savedTab;
            } else {
              this.activeTab = (this.role === 'admin') ? 'dashboard' : 'vault';
              sessionStorage.setItem('lastTab', this.activeTab);
            }

            this.refresh();
            this.cdr.detectChanges();
          } else {
            this.executeFrontendSessionWipe();
          }
        },
        error: (err: any) => {
          console.error("Auto-login session restoration failed:", err);
          this.executeFrontendSessionWipe();
        }
      });
    }
  }

  changeTab(tabName: string) {
    this.activeTab = tabName;
    sessionStorage.setItem('lastTab', tabName);
    this.isMobileMenuOpen = false;
    this.refresh();
  }

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
          sessionStorage.setItem('activeLogId', String(res.activeLogId));

          this.activeTab = 'documents';

          this.profileData.username = res.user.username || res.user.name || this.loginName;
          this.profileData.email = res.user.email || '';
          this.profileData.bio = res.user.bio || '';
          this.profileData.profile_pic = res.user.profile_pic || '';
          this.profileData.password = '';
          this.isEditingProfile = false;

          if (res.token) {
            sessionStorage.setItem('token', res.token);
          }

          console.log("hi", res);

          if (this.role === 'admin') {
            this.activeTab = 'dashboard';
            sessionStorage.setItem('lastTab', 'dashboard');
          } else {
            this.activeTab = 'vault';
            sessionStorage.setItem('lastTab', 'vault');
          }

          this.refresh();

        } else {
          Swal.fire({
            title: 'Login Failed',
            text: res.message,
            icon: 'warning',
            confirmButtonColor: '#1e3a8a',
            heightAuto: false
          });
        }
      },
      error: (err: any) => { 
        console.error("Login endpoint failed:", err);
        
        if (err.error && err.error.message) {
          Swal.fire({
            title: 'Login Denied',
            text: err.error.message, 
            icon: 'warning',
            confirmButtonColor: '#1e3a8a',
            heightAuto: false
          });
        } else {
          // Fallback for real network drops or server crashes
          Swal.fire({
            title: 'Connection Error',
            text: 'Could not connect to the server. Please check your network.',
            icon: 'error',
            confirmButtonColor: '#ef4444',
            heightAuto: false
          });
        }
      }
    });
  }

  refresh() {
    const startTime = Date.now();
    const token = sessionStorage.getItem('token');
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
      error: (err: any) => {
        console.error("Fetch current profile status failed:", err);
        Swal.fire({
          title: 'Error',
          text: 'Could not load your latest profile details.',
          icon: 'error',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }
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
    this.fetchGlobalDocumentCount();
  }

  addUser() {
    if (!this.newUserPass || this.newUserPass.length < 8) {
      Swal.fire({
        title: 'Short Password',
        text: 'The password must be at least 8 characters long.',
        icon: 'warning',
        confirmButtonColor: '#1e3a8a',
        heightAuto: false
      });
      return;
    }

    if (!this.newUserName || !this.newUserPass) {
      Swal.fire({
        title: 'Missing Fields',
        text: 'Please fill in both the username and password fields.',
        icon: 'warning',
        confirmButtonColor: '#1e3a8a',
        heightAuto: false
      });
      return;
    }

    const payload = {
      name: this.newUserName,
      role: this.newUserRole,
      password: this.newUserPass
    };
    
    this.http.post<any>('http://localhost:3000/auth/register', payload).subscribe({
      next: (res: any) => { 
        Swal.fire({
          title: 'User Created',
          text: `Successfully created a new account for ${this.newUserName}.`,
          icon: 'success',
          confirmButtonColor: '#10b981',
          heightAuto: false
        });
        this.newUserName = '';
        this.newUserPass = '';
        this.refresh();
      },
      error: (err: any) => { 
        if (err.status === 400) {
          Swal.fire({
            title: 'Name Taken',
            text: 'This username is already being used.',
            icon: 'error',
            confirmButtonColor: '#ef4444',
            heightAuto: false
          });
        } else {
          Swal.fire({
            title: 'Error',
            text: 'Could not create the account. Please try again.',
            icon: 'error',
            confirmButtonColor: '#64748b',
            heightAuto: false
          });
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
      Swal.fire({
        title: 'Error',
        text: 'Cannot save changes. Missing user ID parameter.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        heightAuto: false
      });
      return;
    }

    const token = sessionStorage.getItem('token');
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
          Swal.fire({
            title: 'Changes Saved',
            text: 'User profile updated successfully.',
            icon: 'success',
            confirmButtonColor: '#10b981',
            heightAuto: false
          });
        } else {
          Swal.fire({
            title: 'Update Failed',
            text: res.message,
            icon: 'warning',
            confirmButtonColor: '#1e3a8a',
            heightAuto: false
          });
        }
      },
      error: (err: any) => { 
        Swal.fire({
          title: 'Error Saving',
          text: err.error?.message || 'Could not save updates to the server.',
          icon: 'error',
          confirmButtonColor: '#64748b',
          heightAuto: false
        });
      }
    });
  }

  toggleStatus(userId: number, currentStatus: 'active' | 'deactivated') {
    const token = sessionStorage.getItem('token');
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
        Swal.fire({
          title: 'Status Error',
          text: 'Could not change the user status configuration.',
          icon: 'error',
          confirmButtonColor: '#ef4444',
          heightAuto: false
        });
      }
    });
  }

  fetchVaultDocs() {
    const filter = this.selectedFolderId ? `&folderId=${this.selectedFolderId}` : '';
    const url = `http://localhost:3000/document?search=${this.searchText}${filter}`;
    const token = sessionStorage.getItem('token');
    
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

  fetchGlobalDocumentCount() {
  const token = sessionStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // We hit the base endpoint with no query filters so it matches the whole table
  this.http.get<any[]>('http://localhost:3000/document', { headers }).subscribe({
    next: (d: any[]) => {
      this.totalDocumentsCount = d.length;
      this.cdr.detectChanges();
    },
    error: (err: any) => {
      console.error("Global document count fetch failed:", err);
    }
  });
}

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  uploadDocument() {
    if (!this.uploadTitle.trim()) {
      Swal.fire({
        title: 'Name Required',
        text: 'Please enter a display title for your file before uploading.',
        icon: 'warning',
        confirmButtonColor: '#1e3a8a',
        heightAuto: false
      });
      return;
    }

    const token = sessionStorage.getItem('token');
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
        this.fetchGlobalDocumentCount();
  
        Swal.fire({
          title: 'Document Uploaded',
          text: 'Your file has been saved successfully.',
          icon: 'success',
          confirmButtonColor: '#10b981',
          heightAuto: false
        });
      },
      error: (err: any) => { 
        console.error(err);
        Swal.fire({
          title: 'Upload Failed',
          text: 'The server could not process your file upload.',
          icon: 'error',
          confirmButtonColor: '#ef4444',
          heightAuto: false
        });
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
    const token = sessionStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

  this.fetchGlobalDocumentCount();  this.http.put(
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
        Swal.fire({
          title: 'Document Updated',
          text: 'File details were changed successfully.',
          icon: 'success',
          confirmButtonColor: '#10b981',
          heightAuto: false
        });
      },
      error: (err: any) => { 
        console.error(err);
        Swal.fire({
          title: 'Update Error',
          text: 'Could not change the document properties.',
          icon: 'error',
          confirmButtonColor: '#ef4444',
          heightAuto: false
        });
      }
    });
  }

  removeDocument(id: number) {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to permanently delete this file from the system storage?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      heightAuto: false
    }).then((result) => {
      if (result.isConfirmed) {
        const token = sessionStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        this.http.delete(
          `http://localhost:3000/document/${id}?uploaded_by=${this.currentUserId}`,
          { headers }
        ).subscribe({
          next: () => {
            Swal.fire({
              title: 'Deleted',
              text: 'The document was removed completely.',
              icon: 'success',
              confirmButtonColor: '#10b981',
              heightAuto: false
            });
            this.fetchVaultDocs();
            this.fetchGlobalDocumentCount();
            this.cdr.detectChanges();
          },
          error: (err: any) => { 
            console.error(err);
            Swal.fire({
              title: 'Delete Failed',
              text: 'The server rejected the deletion query request.',
              icon: 'error',
              confirmButtonColor: '#ef4444',
              heightAuto: false
            });
          }
        });
      }
    });
  }

  downloadFile(id: number, filename: string) {
    const token = sessionStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

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
        Swal.fire({
          title: 'Download Error',
          text: 'Could not fetch the file package from the server folder.',
          icon: 'error',
          confirmButtonColor: '#ef4444',
          heightAuto: false
        });
      }
    });
  }

  fetchFolders() {
    const token = sessionStorage.getItem('token');
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
        Swal.fire({
          title: 'Error',
          text: "Could not load the system folders layout list.",
          icon: 'error',
          confirmButtonColor: '#64748b',
          heightAuto: false
        });
      }
    });
  }

  createFolder() {
    if (!this.newFolderName || !this.newFolderName.trim()) {
      Swal.fire({
        title: 'Name Required',
        text: 'Please enter a name for your new folder directory.',
        icon: 'warning',
        confirmButtonColor: '#1e3a8a',
        heightAuto: false
      });
      return;
    }

    const token = sessionStorage.getItem('token');
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
        Swal.fire({
          title: 'Folder Created',
          text: 'New directory has been added successfully.',
          icon: 'success',
          confirmButtonColor: '#10b981',
          heightAuto: false
        });
      },
      error: (err: any) => { 
        console.error(err);
        Swal.fire({
          title: 'Creation Failed',
          text: "Could not build the new folder record path.",
          icon: 'error',
          confirmButtonColor: '#ef4444',
          heightAuto: false
        });
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

    const token = sessionStorage.getItem('token');
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
        Swal.fire({
          title: 'Folder Renamed',
          text: 'Changes saved to the directory tree setup.',
          icon: 'success',
          confirmButtonColor: '#10b981',
          heightAuto: false
        });
        this.editingFolder = null;
        this.fetchFolders();
        this.cdr.detectChanges();
      },
      error: (err: any) => { 
        console.error(err);
        Swal.fire({
          title: 'Rename Failed',
          text: 'The server rejected the folder name update.',
          icon: 'error',
          confirmButtonColor: '#ef4444',
          heightAuto: false
        });
      }
    });
  }

  confirmDelete(folder: any) {
    this.folderToDelete = folder;
  }

  performDelete(isCascade: boolean) {
    if (!this.folderToDelete) return;

    const id = this.folderToDelete.id;
    const token = sessionStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    this.http.delete(
      `http://localhost:3000/folders/${id}?cascade=${isCascade}`,
      { headers }
    ).subscribe({
      next: () => {
        this.folderToDelete = null;
        this.fetchFolders();
        this.fetchVaultDocs();
        this.fetchGlobalDocumentCount();
        this.cdr.detectChanges();

        Swal.fire({
          title: 'Folder Deleted',
          text: isCascade ? "The folder and all its documents were deleted." : "The folder was deleted. Its documents were safely moved to Global.",
          icon: 'success',
          confirmButtonColor: '#10b981',
          heightAuto: false
        });
      },
      error: (err: any) => { 
        this.folderToDelete = null;
        console.error("Delete failed:", err);
        Swal.fire({
          title: 'Delete Failed',
          text: "Could not safely drop the folder database object index.",
          icon: 'error',
          confirmButtonColor: '#ef4444',
          heightAuto: false
        });
      }
    });
  }

  toggleProfileEdit(editState: boolean) {
    this.isEditingProfile = editState;

    if (editState) {
      this.profileBackupData = { ...this.profileData };
    } else {
      this.profileData.password = '';
    }

    this.cdr.detectChanges();
  }

  onAvatarSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Swal.fire({
        title: 'Wrong File Type',
        text: 'Please select a valid image file structure (PNG, JPG, JPEG).',
        icon: 'warning',
        confirmButtonColor: '#1e3a8a',
        heightAuto: false
      });
      return;
    }

    this.selectedAvatarFile = file;
    this.cdr.detectChanges();
  }

  updateProfile() {
    if (!this.currentUserId) {
      Swal.fire({
        title: 'Session Error',
        text: 'Your login session expired. Please log in again.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        heightAuto: false
      });
      return;
    }

    const emailInput = this.profileData.email ? this.profileData.email.trim() : '';
    
    if (emailInput !== '') {

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      
      if (!emailRegex.test(emailInput)) {
        Swal.fire({
          title: 'Invalid Email Format',
          text: 'Please enter a valid email address (e.g., sample@domain.com).',
          icon: 'error',
          confirmButtonColor: '#ef4444',
          heightAuto: false
        });
        return; 
      }
    }

    if (this.profileData.password && this.profileData.password.length < 8) {
      Swal.fire({
        title: 'Short Password',
        text: 'The password override must be at least 8 characters long.',
        icon: 'warning',
        confirmButtonColor: '#1e3a8a',
        heightAuto: false
      });
      return;
    }

    const token = sessionStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    const fb = new FormData();
    fb.append('userId', this.currentUserId);
    
    
    if (this.profileData.username) fb.append('username', this.profileData.username);
    if (this.profileData.email) fb.append('email', this.profileData.email);
    if (this.profileData.bio !== undefined && this.profileData.bio !== null) {
      fb.append('bio', this.profileData.bio);
    }
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
          Swal.fire({
            title: 'Profile Saved',
            text: 'Your account settings have been updated successfully.',
            icon: 'success',
            confirmButtonColor: '#10b981',
            heightAuto: false
          });
          
          this.isEditingProfile = false;
          this.selectedAvatarFile = null; 
          
          if (res.profile_pic) {
            this.profileData.profile_pic = res.profile_pic;
          }
          
          this.profileData.password = '';
          
          this.profileBackupData = { ...this.profileData };

          this.refresh();
        } else {
          Swal.fire({
            title: 'Update Refused',
            text: res.message,
            icon: 'warning',
            confirmButtonColor: '#1e3a8a',
            heightAuto: false
          });
        }
      },
      error: (err: any) => { 
        console.error("HTTP Pipe Error during profile patch:", err);
        Swal.fire({
          title: 'System Error 500',
          text: 'Internal Server Error: Check backend query execution logs.',
          icon: 'error',
          confirmButtonColor: '#64748b',
          heightAuto: false
        });
      }
    });
  }

  removeProfilePhoto() {
    if (!this.currentUserId) {
      Swal.fire({
        title: 'Session Error',
        text: 'Your identity could not be verified. Please log in again.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        heightAuto: false
      });
      return;
    }

    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to remove your profile photo and revert to the default avatar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, remove it',
      cancelButtonText: 'Cancel',
      heightAuto: false
    }).then((result) => {
      if (result.isConfirmed) {
        const token = sessionStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        this.http.put<any>('http://localhost:3000/profile/remove-photo', 
          { userId: this.currentUserId }, 
          { headers }
        ).subscribe({
          next: (res: any) => {
            if (res.success) {
              Swal.fire({
                title: 'Removed!',
                text: 'Your profile photo has been removed successfully.',
                icon: 'success',
                confirmButtonColor: '#10b981',
                heightAuto: false
              });

              this.profileData.profile_pic = '';
              this.selectedAvatarFile = null;
              this.profileBackupData.profile_pic = '';
              this.refresh();
            }
          },
          error: (err: any) => {
            console.error('Photo removal pipe failed:', err);
            Swal.fire({
              title: 'Error',
              text: err.error?.message || 'Could not process photo removal from the server directory.',
              icon: 'error',
              confirmButtonColor: '#ef4444',
              heightAuto: false
            });
          }
        });
      }
    });
  }

  logout() {
    const token = sessionStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    this.http.post<any>(
      'http://localhost:3000/auth/logout',
      { activeLogId: this.activeLogId },
      { headers }
    ).subscribe({
      next: () => {
        this.executeFrontendSessionWipe();
      },
      error: (err: any) => { 
        console.error("Failed to record logout stamp gracefully:", err);
        this.executeFrontendSessionWipe();
      }
    });
  }

  private executeFrontendSessionWipe() {
    this.isLoggedIn = false;
    this.loginName = '';
    this.loginPass = '';
    this.role = '';
    this.currentUserId = null;
    this.activeLogId = null;

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('lastTab');
    sessionStorage.removeItem('activeLogId');

    this.cdr.detectChanges();
    
    Swal.fire({
      title: 'Signed Out',
      text: 'You have logged out of your account successfully.',
      icon: 'info',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2500
    });
  }
}