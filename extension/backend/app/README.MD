cd extensions/
cd backend/
source extension/backend/venv/bin/activate.fish
fastapi dev ./app/main.py

SCALABILITY, MAINTAINABILITY, EFFICIENCY, RELIABILITY

Create
users
users/userId/studyPlans
Read
users/userId
users/userId/studyPlans/planId
Update
users/userId
users/userId/studyPlans/planId
Delete
users/userId/studyPlans/planId

# TODO: add status boolean for all tables except users for user_progress logic

# TODO: create user_progress logic, optional: apply weights to section vs subsection

# TODO: create an endpoint for user registration (sending an email)

# TODO: utilize JWT authentication or OAuth

# TODO: research AWS Lambda for serverless

# TODO: research services for hosting database, limitations on current laptop

# TODO:
