import { Client, Account } from "appwrite";

const client = new Client()
  .setEndpoint("https://nyc.cloud.appwrite.io/v1")
  .setProject("691181470024b6460a13")

export const account = new Account(client);
