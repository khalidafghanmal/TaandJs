/** HTTP error page copy shown in ui/errors/error.taand. */
export default {
  pages: {
    400: {
      title: 'Bad Request',
      message: 'The request could not be understood. Check the URL and try again.',
      hint: 'Make sure the link is correct and the form data is valid.',
    },
    401: {
      title: 'Unauthorized',
      message: 'You must sign in to access this page.',
      hint: 'Sign in with your account, then return to this page.',
    },
    403: {
      title: 'Forbidden',
      message: 'You do not have permission to access this resource.',
      hint: 'If you believe this is a mistake, contact an administrator.',
    },
    404: {
      title: 'Page Not Found',
      message: 'The page you are looking for does not exist or has been moved.',
      hint: 'Check the URL for typos, or head back to the home page.',
    },
    405: {
      title: 'Method Not Allowed',
      message: 'This URL does not support that HTTP method.',
      hint: 'Use GET in the browser, or POST/PUT/PATCH for form submissions.',
    },
    413: {
      title: 'Payload Too Large',
      message: 'The request body exceeds the maximum allowed size.',
      hint: 'Try uploading a smaller file or splitting the request.',
    },
    422: {
      title: 'Validation Error',
      message: 'The submitted data could not be validated. Please check your input and try again.',
      hint: 'Review the highlighted fields and submit again.',
    },
    419: {
      title: 'Page Expired',
      message: 'Your session has expired. Please refresh the page and try again.',
      hint: 'This often happens when a form sits open too long. Refresh and resubmit.',
    },
    429: {
      title: 'Too Many Requests',
      message: 'You have made too many requests. Please wait a moment and try again.',
      hint: 'Slow down for a few seconds, then try again.',
    },
    500: {
      title: 'Server Error',
      message: 'Something went wrong on our end. We are working to fix it.',
      hint: 'Try refreshing the page. If the problem persists, check the server logs.',
    },
    503: {
      title: 'Service Unavailable',
      message: 'The server is temporarily unavailable. Please try again shortly.',
      hint: 'The app may be restarting or under maintenance.',
    },
  },
};
