/** Validation messages and human-readable attribute names. */
export default {
  messages: {
    required: 'The :attribute field is required.',
    email: 'The :attribute must be a valid email address.',
    min: 'The :attribute must be at least :min characters.',
    max: 'The :attribute may not be greater than :max characters.',
    confirmed: 'The :attribute confirmation does not match.',
    unique: 'The :attribute has already been taken.',
    exists: 'The selected :attribute is invalid.',
  },

  attributes: {
    email: 'email address',
    password: 'password',
  },

  /** Inputs never flashed back as old() after a failed validation. */
  dontFlash: ['current_password', 'password', 'password_confirmation'],
};
