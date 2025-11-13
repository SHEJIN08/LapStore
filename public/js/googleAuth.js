
const client = new Appwrite.Client()
  .setEndpoint("https://nyc.cloud.appwrite.io/v1") //project endpoint
  .setProject("691181470024b6460a13");        // your Appwrite project ID

const account = new Appwrite.Account(client);

document.getElementById("google-btn").addEventListener("click", async () => {
  try {
    await account.createOAuth2Session(
      "google",
      "http://localhost:5000/user/home",  // success redirect
      "http://localhost:5000/user/login"  // failure redirect
    );
  } catch (error) {
    console.error("Google login failed:", error);
  }
});
