import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { name, email, message } = await request.json();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'devendrakhatik412@gmail.com',
        pass: 'bnrt lheu fxqu eawe',
      },
    });

    const mailOptions = {
      from: 'devendrakhatik412@gmail.com',
      to: 'devendrakhatik412@gmail.com',
      subject: `New Feedback from ${name || 'User'}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: 'Feedback sent successfully' });
  } catch (error) {
    console.error('Error sending feedback:', error);
    return NextResponse.json({ success: false, error: 'Failed to send feedback' }, { status: 500 });
  }
}
