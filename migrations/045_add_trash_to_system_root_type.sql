-- Add 'trash' to the system_root_type enum so the trash root folder can be created
ALTER TYPE system_root_type ADD VALUE IF NOT EXISTS 'trash';
