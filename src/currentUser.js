// AuthGate giriş yapan kullanıcının bilgilerini buraya yazar;
// App.jsx içindeki storageGet/storageSet bu bilgiyi kullanarak
// her hesabın/işletmenin verisini birbirinden izole eder.
export const currentUser = {
  email: null,
  role: 'user',
  businessName: '',
  businessId: null,
  username: null,
};

export const isOwnerRole = (role) => role === 'owner' || role === 'superadmin';
export const isSuperadminRole = (role) => role === 'superadmin';
