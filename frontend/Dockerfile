# script of instructions

# Use the official Node.js runtime as a parent image
FROM node:22-alpine

# set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the app runs on
EXPOSE 5173

# run the app
CMD ["npm", "run", "dev", "--", "--host"]
