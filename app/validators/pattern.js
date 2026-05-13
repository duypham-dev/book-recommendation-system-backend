// Email validation pattern
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Username validation pattern: 3-20 characters, letters/numbers/underscore, no spaces
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

// Password validation pattern (minimum 8 characters, at least one uppercase, one lowercase, one number)
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;

export { EMAIL_PATTERN, USERNAME_PATTERN, PASSWORD_PATTERN };