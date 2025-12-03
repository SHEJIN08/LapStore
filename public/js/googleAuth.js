
const client = new Appwrite.Client()
 .setEndpoint(window.APPWRITE_CONFIG.APPWRITE_ENDPOINT) // must be injected by server
  .setProject(window.APPWRITE_CONFIG.APPWRITE_PROJECT);       // your Appwrite project ID

const account = new Appwrite.Account(client);

document.getElementById("google-btn").addEventListener("click",  () => {

     account.createOAuth2Session(
      "google",
      window.APPWRITE_CONFIG.GOOGLE_CALLBACK,
      window.APPWRITE_CONFIG.LOGIN_REDIRECT
    );
})