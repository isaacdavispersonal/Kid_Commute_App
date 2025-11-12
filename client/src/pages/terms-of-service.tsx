import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfService() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Terms of Service</CardTitle>
          <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-3">Agreement to Terms</h2>
            <p>
              By accessing or using Kid Commute ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Description of Service</h2>
            <p>
              Kid Commute is a transportation service management system that provides:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Real-time vehicle tracking and estimated arrival times</li>
              <li>Route management and scheduling</li>
              <li>Student attendance tracking</li>
              <li>Communication between parents, drivers, and administrators</li>
              <li>Fleet management and reporting tools</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">User Accounts</h2>
            
            <h3 className="text-xl font-semibold mt-4 mb-2">Registration</h3>
            <p>To use Kid Commute, you must:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Be at least 18 years old</li>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
            </ul>

            <h3 className="text-xl font-semibold mt-4 mb-2">Account Roles</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Parents:</strong> View assigned students, track buses, communicate with drivers</li>
              <li><strong>Drivers:</strong> Manage routes, mark attendance, report incidents, track location during active routes</li>
              <li><strong>Administrators:</strong> Full system access including user management, route creation, and reporting</li>
            </ul>

            <h3 className="text-xl font-semibold mt-4 mb-2">Account Responsibilities</h3>
            <p>You are responsible for:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>All activities that occur under your account</li>
              <li>Maintaining the confidentiality of your login credentials</li>
              <li>Ensuring your contact information is current and accurate</li>
              <li>Complying with all applicable laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Acceptable Use</h2>
            <p>You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service for any illegal purpose or in violation of any laws</li>
              <li>Harass, abuse, or harm another person through the Service</li>
              <li>Impersonate any person or entity</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Attempt to gain unauthorized access to any portion of the Service</li>
              <li>Use automated systems (bots, scrapers) without permission</li>
              <li>Transmit viruses, malware, or other harmful code</li>
              <li>Collect or harvest personal information about other users</li>
              <li>Share your account access with unauthorized individuals</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Driver-Specific Terms</h2>
            <p>If you are using the driver app, you additionally agree to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Location Tracking:</strong> Allow background location access during scheduled route times to enable real-time tracking for parents</li>
              <li><strong>Safety Compliance:</strong> Complete vehicle inspections before each route and report all incidents immediately</li>
              <li><strong>Communication:</strong> Respond promptly to parent messages and admin notifications</li>
              <li><strong>Accuracy:</strong> Mark student attendance accurately and update route progress in real-time</li>
              <li><strong>Professional Conduct:</strong> Maintain professional behavior in all communications and interactions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Privacy and Data</h2>
            <p>
              Your use of Kid Commute is also governed by our <a href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</a>. By using the Service, you consent to our collection and use of personal data as outlined in the Privacy Policy.
            </p>
            
            <h3 className="text-xl font-semibold mt-4 mb-2">Student Information</h3>
            <p>
              Parents and administrators who enter student information agree to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Have proper authority to share student information</li>
              <li>Provide accurate and up-to-date student data</li>
              <li>Understand that student information is used solely for transportation services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Service Availability</h2>
            <p>
              We strive to provide reliable service but do not guarantee:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Uninterrupted or error-free operation</li>
              <li>Specific uptime percentages (though we target 99.9%)</li>
              <li>Accuracy of estimated arrival times (ETAs are approximations)</li>
              <li>Availability during maintenance windows (scheduled with advance notice)</li>
            </ul>
            <p className="mt-2">
              We reserve the right to modify or discontinue the Service (or any part thereof) with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are owned by Kid Commute and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
            <p className="mt-2">
              You may not copy, modify, distribute, sell, or lease any part of our Service without express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, KID COMMUTE SHALL NOT BE LIABLE FOR:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, data, use, or goodwill</li>
              <li>Service interruptions or security breaches</li>
              <li>Inaccurate location data or estimated arrival times</li>
              <li>Actions or omissions of drivers, parents, or other users</li>
              <li>Third-party services or integrations (e.g., GPS providers)</li>
            </ul>
            <p className="mt-3">
              Our total liability to you for any claims arising from your use of the Service shall not exceed the amount you paid to us in the twelve months preceding the claim, or $100, whichever is greater.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Warranties of merchantability or fitness for a particular purpose</li>
              <li>Warranties of non-infringement</li>
              <li>Warranties that the Service will be secure, timely, or error-free</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless Kid Commute and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including attorney fees) arising from:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your use or misuse of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party</li>
              <li>Your violation of any applicable laws or regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Breach of these Terms</li>
              <li>Fraudulent, abusive, or illegal activity</li>
              <li>Requests by law enforcement or government agencies</li>
              <li>Discontinuation of the Service</li>
            </ul>
            <p className="mt-2">
              You may terminate your account at any time by contacting us at <a href="mailto:support@kidcommute.com" className="text-primary hover:underline">support@kidcommute.com</a>. Upon termination, your right to use the Service will immediately cease.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
            </p>
            <p className="mt-2">
              Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration in accordance with the American Arbitration Association's rules, except that you may assert claims in small claims court if they qualify.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will provide notice of material changes by:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Posting the updated Terms on this page</li>
              <li>Updating the "Last updated" date</li>
              <li>Sending an email notification (for significant changes)</li>
            </ul>
            <p className="mt-2">
              Your continued use of the Service after changes become effective constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Entire Agreement</h2>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Kid Commute regarding the Service and supersede all prior agreements and understandings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Contact Information</h2>
            <p>If you have questions about these Terms, please contact us:</p>
            <div className="mt-3 space-y-1">
              <p><strong>Email:</strong> <a href="mailto:legal@kidcommute.com" className="text-primary hover:underline">legal@kidcommute.com</a></p>
              <p><strong>Support:</strong> <a href="mailto:support@kidcommute.com" className="text-primary hover:underline">support@kidcommute.com</a></p>
            </div>
          </section>

          <div className="mt-8 pt-6 border-t text-sm text-muted-foreground">
            <p>
              By using Kid Commute, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
