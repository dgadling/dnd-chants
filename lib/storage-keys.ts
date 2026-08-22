export const STORAGE_KEYS = {
  CHARACTERS: "dnd-chant-characters-v1",
  ACTIVE_ID: "dnd-chant-active-character-v1",
  SCHOOL_LANGS: "dnd-chant-school-langs-v1",
  EXTRAS: "dnd-chant-extras-v1",
  HELP_TEMPLATE: "dnd-chant-help-template-v1",
  THEME: "dnd-chant-theme-v1",
  WELCOME: "dnd-chant-welcome-seen-v1",
  BACKUP_ENABLED: "dnd-chant-backup-enabled-v1",
  LAST_BACKUP: "dnd-chant-last-backup-v1",
  LAST_BACKUP_SIZE: "dnd-chant-last-backup-size-v1",
  LAST_CLOUD_ACTION: "dnd-chant-last-cloud-action",
  BACKUP_KEY: "dnd-chant-backup-key",
  DISCORD_USER: "dnd-chant-discord-user-v1",
  PENDING_PIN: "dnd-chant-pending-pin",
  STATE: "dnd-chant-discord-state",
  DDB_LINK: "dnd-chant-ddb-link-v1",
} as const;

// Legacy alias for migration
export const STORAGE_LINK_LEGACY = "dnd-chant-ddb-link-v1";
