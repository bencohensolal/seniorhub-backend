export type CaregiverTodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type CaregiverTodoPriority = 'low' | 'normal' | 'high';

export interface CaregiverTodo {
  id: string;
  householdId: string;
  title: string;
  description: string | null;
  priority: CaregiverTodoPriority;
  status: CaregiverTodoStatus;
  assignedTo: string | null; // household member ID
  dueDate: string | null; // ISO date string (YYYY-MM-DD)
  completedAt: string | null; // ISO timestamp
  completedBy: string | null; // household member ID
  lastNudgedAt: string | null; // ISO timestamp
  nudgeCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string; // household member ID
}

export interface CaregiverTodoComment {
  id: string;
  todoId: string;
  authorId: string; // household member ID
  content: string;
  createdAt: string;
}

export interface CaregiverTodoWithComments extends CaregiverTodo {
  comments: CaregiverTodoComment[];
}

export interface CreateCaregiverTodoInput {
  householdId: string;
  title: string;
  description?: string;
  priority?: CaregiverTodoPriority;
  assignedTo?: string;
  dueDate?: string;
  createdBy: string;
}

export interface UpdateCaregiverTodoInput {
  title?: string;
  description?: string | null;
  priority?: CaregiverTodoPriority;
  status?: CaregiverTodoStatus;
  assignedTo?: string | null;
  dueDate?: string | null;
}
