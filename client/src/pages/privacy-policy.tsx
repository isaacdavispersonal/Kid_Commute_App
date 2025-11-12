import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Privacy Policy</CardTitle>
          <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-3">Introduction</h2>
            <p>
              FleetTrack ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our transportation service management system, including our mobile applications and web services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mt-4 mb-2">Personal Information</h3>
            <p>We collect the following types of personal information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account Information:</strong> Name, email address, phone number, and role (parent, driver, or administrator)</li>
              <li><strong>Student Information:</strong> Student names, assigned routes, pickup/dropoff locations, and attendance records</li>
              <li><strong>Contact Information:</strong> Guardian phone numbers and email addresses for communication purposes</li>
            </ul>

            <h3 className="text-xl font-semibold mt-4 mb-2">Location Data</h3>
            <p>We collect location information as follows:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Driver Location (Real-time):</strong> When drivers are on active routes, we collect precise GPS coordinates to provide real-time bus tracking to parents. This is collected only during scheduled route times.</li>
              <li><strong>Vehicle Location:</strong> We receive location data from fleet management systems (e.g., Samsara) to track vehicle positions during routes</li>
              <li><strong>Stop Locations:</strong> We store the geographic coordinates of pickup and dropoff stops</li>
            </ul>
            <p className="mt-2">
              <strong>Important:</strong> We do NOT collect location data from parent accounts or student devices. Location tracking is limited to driver devices during active routes only.
            </p>

            <h3 className="text-xl font-semibold mt-4 mb-2">Usage Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Log data (IP address, browser type, access times)</li>
              <li>Device information (device type, operating system)</li>
              <li>App usage patterns and interactions</li>
            </ul>

            <h3 className="text-xl font-semibold mt-4 mb-2">Communications</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Messages between parents and drivers</li>
              <li>Announcements from administrators</li>
              <li>Incident reports and feedback</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Provide Services:</strong> Manage routes, track buses, send notifications about arrivals/delays, and facilitate communication</li>
              <li><strong>Safety & Security:</strong> Monitor driver performance, track attendance, and respond to incidents</li>
              <li><strong>Improve Services:</strong> Analyze usage patterns to enhance features and user experience</li>
              <li><strong>Communications:</strong> Send service-related notifications, updates, and emergency alerts</li>
              <li><strong>Compliance:</strong> Meet legal obligations and enforce our Terms of Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Data Retention</h2>
            <p>We retain your information as follows:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>GPS Location Data:</strong> Automatically deleted after 30 days</li>
              <li><strong>Account Information:</strong> Retained until account deletion is requested</li>
              <li><strong>Attendance Records:</strong> Retained for the current school year plus one additional year</li>
              <li><strong>Messages & Communications:</strong> Retained for 90 days after the conversation ends</li>
              <li><strong>Audit Logs:</strong> Retained for one year for security and compliance purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">How We Share Your Information</h2>
            <p>We do not sell your personal information. We may share your information only in these circumstances:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share information</li>
              <li><strong>Service Providers:</strong> Third-party vendors who help us operate our services (hosting, analytics, push notifications). These providers are contractually obligated to protect your data.</li>
              <li><strong>Safety & Legal Requirements:</strong> When required by law, to protect safety, or to respond to legal process</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets (with notice to you)</li>
            </ul>
            
            <h3 className="text-xl font-semibold mt-4 mb-2">Third-Party Services We Use</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Firebase Cloud Messaging:</strong> For push notifications (Google LLC)</li>
              <li><strong>Neon Database:</strong> For secure data storage (Neon, Inc.)</li>
              <li><strong>Samsara:</strong> For fleet GPS data (Samsara Inc.)</li>
              <li><strong>Sentry:</strong> For error monitoring (Functional Software Inc.)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Your Rights and Choices</h2>
            <p>You have the following rights regarding your personal information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from non-essential communications</li>
              <li><strong>Data Portability:</strong> Request your data in a machine-readable format</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at <a href="mailto:privacy@fleettrack.com" className="text-primary hover:underline">privacy@fleettrack.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Children's Privacy</h2>
            <p>
              FleetTrack is not directed to children under 13. Our services are intended for parents, drivers, and administrators—not for direct use by children. We do collect information about students (names, routes, attendance) as necessary to provide our transportation services, but this data is managed by parents and administrators, not collected directly from children.
            </p>
            <p className="mt-2">
              If you believe we have inadvertently collected information directly from a child under 13, please contact us immediately at <a href="mailto:privacy@fleettrack.com" className="text-primary hover:underline">privacy@fleettrack.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Security</h2>
            <p>We implement industry-standard security measures to protect your information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>All data transmitted over HTTPS/TLS encryption</li>
              <li>Database encryption at rest</li>
              <li>Role-based access controls</li>
              <li>Regular security audits and penetration testing</li>
              <li>Webhook signature verification for GPS data</li>
              <li>Rate limiting and DDoS protection</li>
            </ul>
            <p className="mt-2">
              However, no system is 100% secure. We cannot guarantee absolute security but will notify you of any data breaches as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Background Location (Driver App Only)</h2>
            <p>
              <strong>Why we need it:</strong> The driver app requires background location access to provide real-time bus tracking to parents. This allows parents to see their child's bus location and estimated arrival time, even when the driver app is not actively in use.
            </p>
            <p className="mt-2">
              <strong>When it's collected:</strong> Only during scheduled route times when a driver has an active shift. Location tracking automatically stops when the route is completed.
            </p>
            <p className="mt-2">
              <strong>How it's used:</strong> Location data is sent to our servers every 30 seconds to update the bus position on parent maps. This data is retained for only 30 days, then automatically deleted.
            </p>
            <p className="mt-2">
              <strong>Parent apps do NOT track location:</strong> The parent app does not collect or use location data from parent devices.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">International Users</h2>
            <p>
              FleetTrack is operated in the United States. If you are located outside the United States, please be aware that information we collect will be transferred to and processed in the United States. By using our services, you consent to this transfer.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. Continued use of our services after changes become effective constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Contact Us</h2>
            <p>If you have questions about this Privacy Policy or our data practices, please contact us:</p>
            <div className="mt-3 space-y-1">
              <p><strong>Email:</strong> <a href="mailto:privacy@fleettrack.com" className="text-primary hover:underline">privacy@fleettrack.com</a></p>
              <p><strong>Support:</strong> <a href="mailto:support@fleettrack.com" className="text-primary hover:underline">support@fleettrack.com</a></p>
            </div>
          </section>

          <div className="mt-8 pt-6 border-t text-sm text-muted-foreground">
            <p>
              This Privacy Policy is effective as of the date stated above and applies to all users of FleetTrack services, including web and mobile applications.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
