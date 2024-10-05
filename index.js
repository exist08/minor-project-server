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
const Faculty = mongoose.model('teachers', new mongoose.Schema({ facultyName: String, facultyAbbreviation: String, username: String }));
const Subject = mongoose.model('subject', new mongoose.Schema({ subjectCode: String, subjectName: String, subjectAbbreviation: String }));
const Classes = mongoose.model('classes', new mongoose.Schema({ className: String, section: String, schedule: Object }));
const Users = mongoose.model('users', new mongoose.Schema({ username: String, hashedPassword: String, role: String }));
const Students = mongoose.model('students', new mongoose.Schema({ enrollmentNumber: String, name: String, age: String, classId: String }));
const Announcements = mongoose.model('announcements', new mongoose.Schema({
    text: String,
    postedBy: String,
    createdAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: Date,
}));

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
app.post('/api/class/:id/schedule', async (req, res) => {
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

// Fetch class schedule by classId
app.get('/api/class/:id/schedule', async (req, res) => {
    const classId = req.params.id;
    console.log(classId);
    try {
        const classData = await Classes.findById(classId);
        if (classData) {
            res.json(classData.schedule.processedSchedule);
            console.log(classData.schedule)
        } else {
            res.status(404).json({ message: 'Class not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
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

// To create a new room
app.post('/api/rooms', async (req, res) => {
    await Room.create(req.body)
    console.log(req.body);
    res.send('Room created');
})

// To create a new faculty(teacher)
app.post('/api/teachers', async (req, res) => {
    await Faculty.create(req.body)
    console.log(req.body);
    res.send('Faculty created');
})
// To create a new subject
app.post('/api/subjects', async (req, res) => {
    await Subject.create(req.body)
    console.log(req.body);
    res.send('Subject created');
})

// To delete a room by ID
app.delete('/api/rooms/:id', async (req, res) => {
    try {
        const roomId = req.params.id;
        const result = await Room.findByIdAndDelete(roomId);
        
        if (!result) {
            return res.status(404).send('Room not found');
        }

        res.send(`Room with ID ${roomId} deleted successfully`);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while deleting the room');
    }
});

// To delete a teacher (faculty) by ID and their user account
app.delete('/api/teachers/:id', async (req, res) => {
    try {
        const teacherId = req.params.id;
        // Find the teacher first to get their username
        const teacher = await Faculty.findById(teacherId);
        
        if (!teacher) {
            return res.status(404).send('Teacher not found');
        }

        const username = teacher.username;
        // Delete the teacher from the Faculty collection
        await Faculty.findByIdAndDelete(teacherId);
        // Delete the user account with the matching username from the Users collection
        await Users.findOneAndDelete({ username });

        res.send(`Teacher with ID ${teacherId} and associated user account deleted successfully`);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while deleting the teacher and user account');
    }
});


// To delete a subject by ID
app.delete('/api/subjects/:id', async (req, res) => {
    try {
        const subjectId = req.params.id;
        const result = await Subject.findByIdAndDelete(subjectId);
        
        if (!result) {
            return res.status(404).send('Subject not found');
        }

        res.send(`Subject with ID ${subjectId} deleted successfully`);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while deleting the subject');
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
        await Users.create({ username: username, hashedPassword: hashedPassword, role: role })
        console.log(req.body);

        res.status(201).send({ message: 'User account created successfully', user: { username, role } });
    } catch (err) {
        res.status(400).send({ message: 'Error creating account', error: err.message });
    }
});

// Bulk User accounts creation
app.post('/api/users/accounts/create-bulk-users', async (req, res) => {
    const users = req.body; // This will contain the array of users parsed from CSV

    // Iterate over the users and create them in the database
    for (const user of users) {
        const { username, password, role } = user;

        // Validate role
        if (!['teacher', 'student'].includes(role)) {
            return res.status(400).send(`Invalid role for user: ${username}`);
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        await Users.create({ username: username, hashedPassword: hashedPassword, role: role })
        console.log(req.body);

        try {
            await newUser.save();
        } catch (err) {
            return res.status(400).send(`Error creating user ${username}: ${err.message}`);
        }
    }

    res.status(201).send('All users created successfully!');
});

// Bulk Students additions to the class
app.post('/api/bulk-add-students', async (req, res) => {
    try {
        const students = req.body; // expecting array of students in request body
        console.log(students)
        // Filter out entries that do not have an enrollment number
        const validStudents = students.filter(student => student.enrollmentNumber);

        if (validStudents.length === 0) {
            return res.status(400).json({ message: 'No valid students to insert' });
        }

        // Bulk insert valid students into the database
        await Students.insertMany(validStudents);

        res.status(201).json({ message: 'Students added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error adding students', error });
    }
});


// Fetch teachers
// Fetch teachers with details from Teachers collection
app.get('/api/users/teachers', async (req, res) => {
    try {
        // Get the list of teachers from the Users collection (based on role)
        const users = await Users.find({ role: 'teacher' }, 'username');

        // Fetch additional details from the Teachers collection using username
        const teachersDetails = await Promise.all(users.map(async (user) => {
            const teacherInfo = await Faculty.findOne({ username: user.username });
            return {
                ...user._doc, // spread the user info
                teacherDetails: teacherInfo // add the teacher's detailed info
            };
        }));

        res.status(200).json(teachersDetails);
    } catch (err) {
        res.status(500).send('Error fetching teachers: ' + err.message);
    }
});


// Fetch students
// Fetch students with enrollment and details from Students collection
app.get('/api/users/students', async (req, res) => {
    try {
        // Get the list of students from the Users collection
        const users = await Users.find({ role: 'student' }, 'username');

        // Fetch additional details from the Students collection using username
        const studentsDetails = await Promise.all(users.map(async (user) => {
            const studentInfo = await Students.findOne({ enrollmentNumber: user.username });
            return {
                ...user._doc, // spread the user info
                studentDetails: studentInfo // add the student's detailed info including enrollment
            };
        }));

        res.status(200).json(studentsDetails);
    } catch (err) {
        res.status(500).send('Error fetching students: ' + err.message);
    }
});

// Delete User accounts
// To delete a student account by ID (without deleting details)
app.delete('/api/users/students/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Find and delete the student from the Users collection
        const user = await Users.findByIdAndDelete(userId);
        
        if (!user || user.role !== 'student') {
            return res.status(404).send('Student not found or invalid role');
        }

        res.send(`Student account with ID ${userId} deleted successfully`);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while deleting the student');
    }
});
// To delete a teacher account by ID (without deleting details)
app.delete('/api/users/teachers/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Find and delete the teacher from the Users collection
        const user = await Users.findByIdAndDelete(userId);
        
        if (!user || user.role !== 'teacher') {
            return res.status(404).send('Teacher not found or invalid role');
        }

        res.send(`Teacher account with ID ${userId} deleted successfully`);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while deleting the teacher');
    }
});


// Fetch students based on classId
app.get('/api/students/class/:classId', async (req, res) => {
    try {
        const { classId } = req.params;

        // Query the students collection where classId matches
        const students = await Students.find({ classId: classId });

        if (students.length === 0) {
            return res.status(404).json({ message: 'No students found for this class' });
        }

        res.json(students);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});




// User login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(req.body)
    // Find the user in the users collection
    const user = await Users.findOne({ username });
    if (!user) {
        return res.status(400).send('User not found');
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user?.hashedPassword);
    if (!isPasswordValid) {
        return res.status(400).send('Invalid password');
    }

    // Fetch user data from the respective collection based on their role
    if (user.role === 'teacher') {
        const teacherData = await Faculty.findOne({ username });
        if (!teacherData) {
            return res.status(404).send('Teacher data not found');
        }
        res.status(200).json({ role: 'teacher', ...teacherData._doc });
    } else if (user.role === 'student') {
        const studentData = await Students.findOne({ enrollmentNumber: username });
        if (!studentData) {
            return res.status(404).send('Student data not found');
        }
        res.status(200).json({ role: 'student', ...studentData._doc });
    }else if (user.role === 'admin') {
        res.status(200).json({ role: 'admin'  });
    } else {
        res.status(400).send('Invalid role');
    }
});


// Get all active announcements
app.get('/api/announcements', async (req, res) => {
    try {
        const currentDate = new Date();
        const announcements = await Announcements.find({
            expiresAt: { $gt: currentDate }, // Only get non-expired announcements
        });

        res.json(announcements);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching announcements' });
    }
});

// Post a new announcement
app.post('/api/announcements', async (req, res) => {
    const { text, postedBy, expiresAt } = req.body;

    // Validate input
    if (!text || !postedBy || !expiresAt) {
        return res.status(400).json({ message: 'Text, postedBy, and expiresAt are required' });
    }

    const newAnnouncement = new Announcements({
        text,
        postedBy,
        expiresAt: new Date(expiresAt), // Ensure it's stored as a Date
    });

    try {
        const savedAnnouncement = await newAnnouncement.save();
        res.status(201).json(savedAnnouncement);
    } catch (err) {
        res.status(500).json({ message: 'Error creating announcement' });
    }
});


// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
