import type { HouseholdRole } from './Member.js';

export type DocumentFolderType = 'system_root' | 'senior_folder' | 'user_folder';
export type SystemRootType = 'medical' | 'administrative';

export interface DocumentFolder {
  id: string;
  householdId: string;
  parentFolderId: string | null;
  name: string;
  description: string | null;
  type: DocumentFolderType;
  seniorId: string | null; // only for senior_folder
  systemRootType: SystemRootType | null; // only for system_root
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateDocumentFolderInput {
  householdId: string;
  parentFolderId?: string | null | undefined; // null for system roots (but system roots are auto-created)
  name: string;
  description?: string | null | undefined;
  type?: DocumentFolderType | undefined; // optional, defaults to 'user_folder'
  seniorId?: string | null | undefined; // required for senior_folder
  isSystemRoot?: boolean | undefined; // derived from type, kept for compatibility
  systemRootType?: SystemRootType | null | undefined; // only for system_root
  createdByUserId: string;
}

export interface UpdateDocumentFolderInput {
  name?: string | undefined;
  description?: string | null | undefined;
  parentFolderId?: string | null | undefined; // moving folder
}

export interface DocumentFolderWithCounts extends DocumentFolder {
  folderCount: number;
  documentCount: number;
}

export interface DocumentFolderTreeNode extends DocumentFolderWithCounts {
  children: DocumentFolderTreeNode[];
}

// Helper to check if a folder is a system root
export const isSystemRoot = (folder: DocumentFolder): boolean => folder.type === 'system_root';

// Helper to check if a folder is a senior folder
export const isSeniorFolder = (folder: DocumentFolder): boolean => folder.type === 'senior_folder';

// Helper to check if a folder is a medical root
export const isMedicalRoot = (folder: DocumentFolder): boolean =>
  folder.type === 'system_root' && folder.systemRootType === 'medical';

// Helper to check if a folder is an administrative root
export const isAdministrativeRoot = (folder: DocumentFolder): boolean =>
  folder.type === 'system_root' && folder.systemRootType === 'administrative';
