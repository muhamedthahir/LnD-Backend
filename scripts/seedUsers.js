const bcrypt = require('bcrypt');
const User = require('../models/User');
require('../config/db');

async function seedUsers() {
  try {
    console.log('Starting user seeding...');

    // Primary Admin
    const primaryAdminEmail = 'admin@edtech.com';
    const primaryAdminPassword = 'Admin@123';
    const primaryAdminExists = await User.findByEmail(primaryAdminEmail);
    
    if (!primaryAdminExists) {
      const hashedPrimaryAdminPassword = await bcrypt.hash(primaryAdminPassword, 10);
      await User.create({
        name: 'Primary Administrator',
        email: primaryAdminEmail,
        password: hashedPrimaryAdminPassword,
        role: 'primary_admin',
        college_name: null
      });
      console.log('✓ Primary Admin created');
      console.log(`  Email: ${primaryAdminEmail}`);
      console.log(`  Password: ${primaryAdminPassword}`);
    } else {
      console.log('⚠ Primary Admin already exists');
    }

    // College Admin for MBU
    const collegeAdminEmail = 'mbu.admin@edtech.com';
    const collegeAdminPassword = 'MBUAdmin@123';
    const collegeAdminExists = await User.findByEmail(collegeAdminEmail);
    
    if (!collegeAdminExists) {
      const hashedCollegeAdminPassword = await bcrypt.hash(collegeAdminPassword, 10);
      await User.create({
        name: 'MBU College Administrator',
        email: collegeAdminEmail,
        password: hashedCollegeAdminPassword,
        role: 'college_admin',
        college_name: 'MBU'
      });
      console.log('✓ College Admin (MBU) created');
      console.log(`  Email: ${collegeAdminEmail}`);
      console.log(`  Password: ${collegeAdminPassword}`);
    } else {
      console.log('⚠ College Admin (MBU) already exists');
    }

    // Student with random name
    const studentNames = ['Alex Johnson', 'Sarah Williams', 'Michael Brown', 'Emily Davis', 'James Wilson'];
    const randomName = studentNames[Math.floor(Math.random() * studentNames.length)];
    const studentEmail = 'student@edtech.com';
    const studentPassword = 'Student@123';
    const studentExists = await User.findByEmail(studentEmail);
    
    if (!studentExists) {
      const hashedStudentPassword = await bcrypt.hash(studentPassword, 10);
      await User.create({
        name: randomName,
        email: studentEmail,
        password: hashedStudentPassword,
        role: 'student',
        college_name: null
      });
      console.log('✓ Student created');
      console.log(`  Name: ${randomName}`);
      console.log(`  Email: ${studentEmail}`);
      console.log(`  Password: ${studentPassword}`);
    } else {
      console.log('⚠ Student already exists');
    }

    console.log('\n=== User Credentials Summary ===');
    console.log('\n1. Primary Admin:');
    console.log(`   Email: ${primaryAdminEmail}`);
    console.log(`   Password: ${primaryAdminPassword}`);
    console.log('\n2. College Admin (MBU):');
    console.log(`   Email: ${collegeAdminEmail}`);
    console.log(`   Password: ${collegeAdminPassword}`);
    console.log('\n3. Student:');
    if (!studentExists) {
      console.log(`   Name: ${randomName}`);
    }
    console.log(`   Email: ${studentEmail}`);
    console.log(`   Password: ${studentPassword}`);
    console.log('\nSeeding completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
}

seedUsers();

