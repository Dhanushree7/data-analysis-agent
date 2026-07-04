# Use a Node base image, then add Python on top
FROM node:20-bookworm

# Install Python 3 and pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Create a "py" command that forwards to python3
# (this lets the existing code's spawn("py", ...) calls work unmodified on Linux)
RUN ln -s /usr/bin/python3 /usr/local/bin/py

WORKDIR /app

# Install Node dependencies
COPY package.json package-lock.json ./
RUN npm install

# Install Python dependencies
RUN pip install --break-system-packages pandas openpyxl groq

# Copy the rest of the project
COPY . .

# Build the frontend/backend
RUN npm run build

# Render provides its own PORT, but this app is hardcoded to 3000 —
# Render will auto-detect it as long as the app binds to 0.0.0.0:3000
EXPOSE 3000

CMD ["npm", "run", "start"]
