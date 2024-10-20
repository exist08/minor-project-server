const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');  // Import bcrypt
const multer = require('multer');
const path = require('path');

// Initialize express
const app = express();
app.use(cors());
app.use(express.json());
// Make the uploads directory static and publicly accessible
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Also ensure the uploads directory exists
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/minor-projectv1', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB connected!"))
    .catch(err => console.error("MongoDB connection error:", err));

// Define schemas for Rooms, Faculty, and Subjects
const Room = mongoose.model('room', new mongoose.Schema({ roomName: String }));
const Faculty = mongoose.model('teachers', new mongoose.Schema({
    facultyName: String, facultyAbbreviation: String, username: String, subjects: [
        {
            subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
            subjectName: { type: String },
            uploadPermission: { type: Boolean, default: false }
        }
    ]
}));
const Subject = mongoose.model('subjects', new mongoose.Schema({ subjectCode: String, subjectName: String, subjectAbbreviation: String }));
const Classes = mongoose.model('classes', new mongoose.Schema({
    className: { type: String, required: true },
    section: { type: String },
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }], // Array of teacher IDs
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }], // Array of subject IDs
    schedule: {
        type: Object, // or Array, depending on your structure
        default: {}
    }
}));
const Permission = mongoose.model('Permission', new mongoose.Schema({
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    havePermission: { type: Boolean, default: false },
}));
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
const Marks = mongoose.model('marks', new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classes', required: true },
    grades: {
        MST_I: [
            {
                subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
                marks: { type: Number, required: true },
                maxMarks: { type: Number, required: true },
            },
        ],
        MST_II: [
            {
                subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
                marks: { type: Number, required: true },
                maxMarks: { type: Number, required: true },
            },
        ],
        FINAL: [
            {
                subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
                marks: { type: Number, required: true },
                maxMarks: { type: Number, required: true },
            },
        ],
    },
}));

const Materials = mongoose.model('materials', new mongoose.Schema({
    classId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Class' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Teacher' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Subject' },
    filePath: { type: String, required: true }, // Path to the uploaded file
    fileName: { type: String, required: true }, // Original filename
    uploadDate: { type: Date, default: Date.now }, // Date of upload
}));

const Assignments = mongoose.model('assignments', new mongoose.Schema({
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    dueDate: {
        type: Date,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
}, {
    timestamps: true
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
            res.json(classData?.schedule?.processedSchedule);
            console.log(classData?.schedule)
        } else {
            res.status(404).json({ message: 'Class not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Fetch class subjects by classId

app.get('/api/class/:id/subjects', async (req, res) => {
    const classId = req.params.id;
    try {
        const classData = await Classes.findById(classId);
        if (classData) {
            res.json(classData.subjects);
        } else {
            res.status(404).json({ message: 'Class not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// get permissions for a class and teacher
app.get('/permissions', async (req, res) => {
    try {
        const { classId, teacherId } = req.query;

        if (!classId || !teacherId) {
            return res.status(400).json({ message: 'Missing classId or teacherId' });
        }

        const permissions = await Permission.find({ classId, teacherId, havePermission: true })
            .populate('subjectId');

        return res.json(permissions);
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ message: 'Internal server error' });
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
    } else if (user.role === 'admin') {
        res.status(200).json({ role: 'admin' });
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


// To Upload Marks as a Teacher
app.post('/api/upload-marks', async (req, res) => {
    const marksArray = req.body; // assuming req.body is an array of marks data

    const bulkOps = marksArray.map(({ studentId, classId, subjectId, examType, marks, maxMarks }) => {
        const examField = `grades.${examType}`;

        return {
            updateOne: {
                filter: {
                    studentId: studentId,
                    classId: classId,
                    [`${examField}`]: { $elemMatch: { subject: subjectId } } // Check if the subject exists
                },
                update: {
                    $set: {
                        [`${examField}.$.marks`]: marks,    // Update marks
                        [`${examField}.$.maxMarks`]: maxMarks // Update maxMarks if needed
                    }
                },
                upsert: false // Only update if subject exists
            }
        };
    });

    // Second bulk operation to handle cases where the subject doesn't exist
    const newMarksOps = marksArray.map(({ studentId, classId, subjectId, examType, marks, maxMarks }) => {
        const examField = `grades.${examType}`;

        return {
            updateOne: {
                filter: {
                    studentId: studentId,
                    classId: classId
                },
                update: {
                    $push: {
                        [examField]: { subject: subjectId, marks: marks, maxMarks: maxMarks } // Insert new marks
                    }
                },
                upsert: true // If student or class is not found, create a new entry
            }
        };
    });

    // Combine both update and insert operations
    Marks.bulkWrite([...bulkOps, ...newMarksOps])
        .then(result => {
            console.log(result);
            res.status(200).send('Marks updated successfully');
        })
        .catch(err => {
            console.error('Error updating marks:', err);
            res.status(500).send('Error uploading marks');
        });

});

// To Fetch Marks as a Student
app.get('/api/marks/:studentId', async (req, res) => {
    const studentId = req.params.studentId;

    try {
        // Use 'new' when creating a new ObjectId instance
        const marks = await Marks.findOne({ studentId: new mongoose.Types.ObjectId(studentId) });

        if (!marks) {
            return res.status(404).json({ message: 'Marks not found for this student.' });
        }

        // Return marks
        return res.status(200).json(marks);
    } catch (error) {
        console.error('Error fetching marks:', error);
        return res.status(500).json({ message: 'Server error while fetching marks.' });
    }
});



// PUT: Assign Subjects to Class
app.put('/api/classes/:classId/assign-subjects', async (req, res) => {
    const { classId } = req.params;
    const { subjects } = req.body; // An array of subject IDs

    if (!subjects || !Array.isArray(subjects)) {
        return res.status(400).json({ message: 'Invalid input. Subjects should be an array of IDs.' });
    }

    try {
        // Find the class and update the subjects array
        const updatedClass = await Classes.findByIdAndUpdate(
            classId,
            { subjects: subjects },
            { new: true } // Return the updated document
        );

        if (!updatedClass) {
            return res.status(404).json({ message: 'Class not found' });
        }

        res.json({ message: 'Subjects assigned successfully', updatedClass });
    } catch (error) {
        console.error('Error assigning subjects:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT: Assign Teachers to Class
// app.put('/api/classes/:classId/assign-teachers', async (req, res) => {
//     const { classId } = req.params;
//     const { teachers } = req.body; // An array of teacher IDs

//     if (!teachers || !Array.isArray(teachers)) {
//         return res.status(400).json({ message: 'Invalid input. Teachers should be an array of IDs.' });
//     }

//     try {
//         // Find the class and update the teachers array
//         const updatedClass = await Classes.findByIdAndUpdate(
//             classId,
//             { teachers: teachers },
//             { new: true } // Return the updated document
//         );

//         if (!updatedClass) {
//             return res.status(404).json({ message: 'Class not found' });
//         }

//         res.json({ message: 'Teachers assigned successfully', updatedClass });
//     } catch (error) {
//         console.error('Error assigning teachers:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// });

// Backend - assign-teachers route
app.put('/api/classes/:classId/assign-teachers', async (req, res) => {
    try {
        const { classId } = req.params;
        const { teacherIds } = req.body; // Array of teacher IDs

        // 1. Fetch class by ID, only fetching the subject IDs from the subjects array
        const classData = await Classes.findById(classId).populate('subjects');

        if (!classData) {
            return res.status(404).json({ message: 'Class not found' });
        }

        // 2. Fetch full details of subjects using the subject IDs from the class data
        const subjectIds = classData?.subjects; // Array of ObjectId references
        const subjects = await Subject.find({ '_id': { $in: subjectIds } }); // Get all subject details

        // 3. Loop through the teacher IDs and add subjects to their records
        for (const teacherId of teacherIds) {
            const teacher = await Faculty.findById(teacherId);

            if (!teacher) {
                return res.status(404).json({ message: `Teacher with id ${teacherId} not found` });
            }

            // Prepare the subjects with detailed info
            const subjectsWithDetails = subjects.map(subject => ({
                subjectId: subject._id,
                subjectName: subject.name, // Assuming 'name' is the subject name
                uploadPermission: false,  // Default permission is false
            }));

            // 4. Add these subjects to the teacher's subjects array
            await Faculty.updateOne(
                { _id: teacherId },
                { $addToSet: { subjects: { $each: subjectsWithDetails } } }
            );
        }

        res.status(200).json({ message: 'Teachers successfully assigned to the class' });
    } catch (error) {
        console.error('Error assigning teachers:', error);
        res.status
    }
});


app.get('/api/classes/:classId/teachers', async (req, res) => {
    const { classId } = req.params;
    try {
        // Find the class and retrieve the teachers array
        const classData = await Classes.findById(classId);
        if (!classData) {
            return res.status(404).json({ message: 'Class not found' });
        }

        res.json(classData.teachers);
    } catch (error) {
        console.error('Error fetching class data:', error);
        res.status(500).json({ message: 'Server error' });
    }
})

app.get('/api/classes/:classId/subjects', async (req, res) => {

    const { classId } = req.params;
    try {
        // Find the class and retrieve the subjects array
        const classData = await Classes.findById(classId);
        if (!classData) {
            return res.status(404).json({ message: 'Class not found' });
        }
        res.json(classData.subjects);

    } catch (error) {
        console.error('Error fetching class data:', error);
        res.status(500).json({ message: 'Server error' });

    }
})

// Route for assigning permissions
app.post('/api/permissions', async (req, res) => {
    try {
        const permissions = req.body; // Array of permission objects
        await Permission.insertMany(permissions);
        res.status(200).send('Permissions assigned successfully');
    } catch (error) {
        res.status(500).send('Error assigning permissions');
    }
});

app.get('/api/permissions', async (req, res) => {
    const { classId } = req.query;
    try {
        const permissions = await Permission.find({ classId });
        res.status(200).json(permissions);
    } catch (error) {
        res.status(500).send('Error fetching permissions');
    }
});



// File Upload Handler
// Set up storage for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Directory to store files
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`); // Filename to avoid conflicts
    },
});

// File filter to accept only PDF or DOCX files
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file type'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5, // Limit file size to 5MB
    },
    fileFilter: fileFilter,
});

app.post('/api/materials/upload', upload.single('file'), async (req, res) => {
    const { classId, teacherId, subjectId } = req.body;

    if (!classId || !teacherId || !subjectId || !req.file) {
        return res.status(400).send('Missing required fields');
    }

    try {
        const newMaterial = new Materials({
            classId: new mongoose.Types.ObjectId(classId),
            teacherId: new mongoose.Types.ObjectId(teacherId),
            subjectId: new mongoose.Types.ObjectId(subjectId),
            filePath: req.file.path,
            fileName: req.file.originalname,
        });

        await newMaterial.save();
        res.status(200).json({ message: 'File uploaded successfully', material: newMaterial });
    } catch (error) {
        res.status(500).json({
            message: 'Error uploading file',
            error: error.message  // Add this line to send the actual error
        });
    }
});

// In your materials routes file
app.get('/api/materials', async (req, res) => {
    const { classId, teacherId, subjectId } = req.query;

    try {
        const materials = await Materials.find({
            classId: new mongoose.Types.ObjectId(classId),
            teacherId: new mongoose.Types.ObjectId(teacherId),
            subjectId: new mongoose.Types.ObjectId(subjectId)
        });
        res.json(materials);
    } catch (error) {
        console.error('Error fetching materials:', error);
        res.status(500).json({ message: 'Error fetching materials', error: error.message });
    }
});

// Endpoint to get materials by classId
app.get('/api/materials/class/:classId', async (req, res) => {
    const { classId } = req.params;

    try {
        // Fetch materials with the provided classId
        const materials = await Materials.find({
            classId: new mongoose.Types.ObjectId(classId)
        });

        // Return the materials if found
        res.json(materials);
    } catch (error) {
        console.error('Error fetching materials:', error);
        res.status(500).json({ message: 'Error fetching materials', error: error.message });
    }
});

// Add delete route
app.delete('/api/materials/:id', async (req, res) => {
    try {
        const material = await Materials.findById(req.params.id);
        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        // Delete the file from storage
        const filePath = path.join(__dirname, '..', material.filePath);
        try {
            await fs.unlink(filePath);
        } catch (unlinkError) {
            console.error('Error deleting file:', unlinkError);
        }

        // Delete the database record
        await Materials.findByIdAndDelete(req.params.id);
        res.json({ message: 'Material deleted successfully' });
    } catch (error) {
        console.error('Error deleting material:', error);
        res.status(500).json({ message: 'Error deleting material', error: error.message });
    }
});


// assignments
// Create new assignment
app.post('/api/assignments/upload', upload.single('file'), async (req, res) => {
    const { classId, teacherId, subjectId, title, description, dueDate } = req.body;

    if (!classId || !teacherId || !subjectId || !req.file || !title || !dueDate) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const newAssignment = new Assignments({
            classId: new mongoose.Types.ObjectId(classId),
            teacherId: new mongoose.Types.ObjectId(teacherId),
            subjectId: new mongoose.Types.ObjectId(subjectId),
            title,
            description,
            dueDate,
            filePath: req.file.path,
            fileName: req.file.originalname,
        });

        await newAssignment.save();
        res.status(200).json({ message: 'Assignment created successfully', assignment: newAssignment });
    } catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({ message: 'Error creating assignment', error: error.message });
    }
});

// Get assignments for a class/subject/teacher
app.get('/api/assignments', async (req, res) => {
    const { classId, teacherId, subjectId } = req.query;

    try {
        const assignments = await Assignments.find({
            classId: new mongoose.Types.ObjectId(classId),
            teacherId: new mongoose.Types.ObjectId(teacherId),
            subjectId: new mongoose.Types.ObjectId(subjectId)
        });
        res.json(assignments);
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ message: 'Error fetching assignments', error: error.message });
    }
});

// Get assignments for a class
app.get('/api/assignments/class/:classId', async (req, res) => {
    const { classId } = req.params;

    try {
        const assignments = await Assignments.find({
            classId: new mongoose.Types.ObjectId(classId)
        });
        res.json(assignments);
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ message: 'Error fetching assignments', error: error.message });
    }
});

// Delete assignment
app.delete('/api/assignments/:id', async (req, res) => {
    try {
        const assignment = await Assignments.findById(req.params.id);
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        // Delete the file from storage
        const filePath = path.join(__dirname, '..', assignment.filePath);
        try {
            await fs.unlink(filePath);
        } catch (unlinkError) {
            console.error('Error deleting file:', unlinkError);
        }

        // Delete the database record
        await Assignments.findByIdAndDelete(req.params.id);
        res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        console.error('Error deleting assignment:', error);
        res.status(500).json({ message: 'Error deleting assignment', error: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
