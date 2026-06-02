import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UsersComponent } from './users/users'; // Add this line

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [UsersComponent], // Add UsersComponent here
  templateUrl: './app.html',
})
export class App {
  title = 'frontend-app';
}