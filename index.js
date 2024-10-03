const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');  // Import bcrypt

// Initialize express
const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/minor-projectv1', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB connected!"))
    .catch(err => console.error("MongoDB connection error:", err));

// Define schemas for Rooms, Faculty, and Subjects
const Room = mongoose.model('room', new mongoose.Schema({ roomName: String }));
const Faculty = mongoose.model('teachers', new mongoose.Schema({ facultyName: String, facultyAbbreviation: String }));
const Subject = mongoose.model('subject', new mongoose.Schema({ subjectCode: String, subjectName: String, subjectAbbreviation: String }));
const Classes = mongoose.model('classes', new mongoose.Schema({ className: String, section: String, schedule: Object }));
const Users = mongoose.model('users', new mongoose.Schema({ username: String, hashedPassword: String, role: String }));

// Routes
// Fetch rooms
app.get('/api/rooms', async (req, res) => {
    try {
        const rooms = await Room.find();
        res.json(rooms);
    } catch (error) {
        res.status(500).send("Error fetching rooms");
    }
});

// Fetch faculty
app.get('/api/teachers', async (req, res) => {
    try {
        const faculty = await Faculty.find();
        res.json(faculty);
    } catch (error) {
        res.status(500).send("Error fetching faculty");
    }
});

// Fetch subjects
app.get('/api/subjects', async (req, res) => {
    try {
        const subjects = await Subject.find();
        res.json(subjects);
    } catch (error) {
        res.status(500).send("Error fetching subjects");
    }
});

// Fetch classes
app.get('/api/classes', async (req, res) => {
    try {
        const classes = await Classes.find();
        res.json(classes);
    } catch (error) {
        res.status(500).send("Error fetching classes");
    }
})

// To create a new class
app.post('/api/classes', async (req, res) => {
    await Classes.create(req.body)
    console.log(req.body);
    res.send('Class created');
})

// Add Schedule to class
app.post('/api/classes/:id/schedule', async (req, res) => {
    const classId = req.params.id;
    const schedule = req.body; // Expect the schedule data from the request body
    console.log(req.body);
    try {
        // Find the class by ID
        const classToUpdate = await Classes.findById(classId);

        if (!classToUpdate) {
            return res.status(404).json({ message: 'Class not found' });
        }

        // Update the schedule
        classToUpdate.schedule = schedule;

        // Save the updated class document
        await classToUpdate.save();

        res.status(200).json({ message: 'Schedule updated successfully', class: classToUpdate });
    } catch (error) {
        res.status(500).json({ message: 'Error updating schedule', error: error.message });
    }
});

// Delete a class
app.delete('/api/classes/:id', async (req, res) => {
    const classId = req.params.id;
    try {
        const classToDelete = await Classes.findByIdAndDelete(classId);
        if (!classToDelete) {
            return res.status(404).json({ message: 'Class not found' });
        }

        res.status(200).json({ message: 'Class deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting class', error });
    }
})

// BULK UPLOAD ROUTES
// Bulk upload rooms
app.post('/api/rooms/bulk', async (req, res) => {
    try {
        // Filter out empty or invalid entries
        const validRooms = req.body.filter(room => room.roomName && room.roomName.trim() !== '');

        if (validRooms.length === 0) {
            return res.status(400).send('No valid rooms found in the CSV.');
        }

        await Room.insertMany(validRooms);
        res.status(200).send('Rooms uploaded successfully');
    } catch (error) {
        res.status(500).send('Error uploading rooms: ' + error.message);
    }
});

// Bulk upload faculty (teachers)
app.post('/api/teachers/bulk', async (req, res) => {
    try {
        // Filter out empty or invalid entries
        const validTeachers = req.body.filter(teacher =>
            teacher.facultyName && teacher.facultyName.trim() !== '' &&
            teacher.facultyAbbreviation && teacher.facultyAbbreviation.trim() !== ''
        );

        if (validTeachers.length === 0) {
            return res.status(400).send('No valid teachers found in the CSV.');
        }

        await Faculty.insertMany(validTeachers);
        res.status(200).send('Teachers uploaded successfully');
    } catch (error) {
        res.status(500).send('Error uploading teachers: ' + error.message);
    }
});

// Bulk upload subjects
app.post('/api/subjects/bulk', async (req, res) => {
    try {
        // Filter out empty or invalid entries
        const validSubjects = req.body.filter(subject =>
            subject.subjectCode && subject.subjectCode.trim() !== '' &&
            subject.subjectName && subject.subjectName.trim() !== '' &&
            subject.subjectAbbreviation && subject.subjectAbbreviation.trim() !== ''
        );

        if (validSubjects.length === 0) {
            return res.status(400).send('No valid subjects found in the CSV.');
        }

        await Subject.insertMany(validSubjects);
        res.status(200).send('Subjects uploaded successfully');
    } catch (error) {
        res.status(500).send('Error uploading subjects: ' + error.message);
    }
});

// User accounts creation
app.post('/api/users/accounts', async (req, res) => {
    try {
        const { username, password, role } = req.body;

        // Check if the user already exists
        const existingUser = await Users.findOne({ username });
        if (existingUser) {
            return res.status(400).send('User with this username already exists');
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);  // Generate salt
        const hashedPassword = await bcrypt.hash(password, salt);  // Hash the password

        // Create a new user
        await Users.create({username: username, hashedPassword: hashedPassword, role: role})
        console.log(req.body);

        res.status(201).send({ message: 'User account created successfully', user: { username, role } });
    } catch (err) {
        res.status(400).send({ message: 'Error creating account', error: err.message });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
