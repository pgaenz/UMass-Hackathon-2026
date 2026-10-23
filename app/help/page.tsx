import type { Metadata } from "next";
import Link from "next/link";

import { FaqHashOpener } from "@/components/faq-hash-opener";
import { FaqItem } from "@/components/faq-item";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description:
    "Plain-language answers about signing in, asking and answering questions, reading stories, privacy, and accessibility.",
};

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-6 py-10">
      <FaqHashOpener />
      <PageHeader
        title="Help & frequently asked questions"
        description="Short, plain-language answers about using HistorAI. Click or tap a question to open its answer."
      />

      <section aria-labelledby="quick-links-heading" className="space-y-4">
        <h2 id="quick-links-heading" className="text-2xl font-bold tracking-tight text-ink">
          Where would you like to go?
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <ButtonLink href="/questions" variant="secondary" size="lg" className="w-full">
            Ask a question
          </ButtonLink>
          <ButtonLink href="/senior" variant="secondary" size="lg" className="w-full">
            Answer a question
          </ButtonLink>
          <ButtonLink href="/youth" variant="secondary" size="lg" className="w-full">
            Read stories
          </ButtonLink>
        </div>
        <p className="rounded-2xl border border-seaglass/40 bg-seaglass/25 px-5 py-4 text-lg text-ink/80">
          <strong className="font-semibold text-ink">Need bigger text?</strong> Use the{" "}
          <span className="font-semibold text-ink">A</span>,{" "}
          <span className="font-semibold text-ink">A+</span>, and{" "}
          <span className="font-semibold text-ink">A++</span> buttons at the top of every page.
          Your choice is remembered on this device.
        </p>
      </section>

      <section aria-labelledby="getting-started-heading" className="space-y-4">
        <h2 id="getting-started-heading" className="text-2xl font-bold tracking-tight text-ink">
          Getting started
        </h2>

        <FaqItem id="what-is-historai" question="What is HistorAI?">
          <p>
            HistorAI connects younger people with older adults. A younger person asks a
            question, an older adult answers it in their own words, and HistorAI helps turn
            that answer into a short, readable story.
          </p>
        </FaqItem>

        <FaqItem id="password" question="Do I need a password?">
          <p>
            No. You choose whether you are a River or a Drop, then enter your name and age.
            That creates your profile for this demo, and you can come back in the same
            browser without a password.
          </p>
        </FaqItem>

        <FaqItem id="river-or-drop" question="What is the difference between a River and a Drop?">
          <p>
            A <strong className="font-semibold text-ink">River</strong> is an older adult who
            answers questions and shares stories. A{" "}
            <strong className="font-semibold text-ink">Drop</strong> is a younger person who
            asks questions and reads stories.
          </p>
        </FaqItem>

        <FaqItem id="visitor" question="Can I look around without signing in?">
          <p>
            Yes. On the sign-in page, choose{" "}
            <Link href="/login">Continue as a visitor</Link>. Visitors can read every
            question and story. Asking, answering, and upvoting require a profile.
          </p>
        </FaqItem>

        <FaqItem id="age" question="Is there an age requirement?">
          <p>
            You must be at least 13 years old. Your exact age is used to confirm that and to
            show an age range on your profile, but it is never shown in full.
          </p>
        </FaqItem>
      </section>

      <section aria-labelledby="account-heading" className="space-y-4">
        <h2 id="account-heading" className="text-2xl font-bold tracking-tight text-ink">
          Your account
        </h2>

        <FaqItem
          id="edit-profile"
          question="How do I change my name, age, bio, or interests?"
        >
          <p>
            Open <Link href="/profile">your profile</Link> from your name at the top right of
            the page. Make your changes, then choose <strong>Save profile</strong>. A bio is
            checked to make sure it is family-friendly before it is saved.
          </p>
        </FaqItem>

        <FaqItem id="age-range" question="Why does my profile show an age range instead of my age?">
          <p>
            Your exact age is private. Other people see only a range, such as 18–29 or 60–74.
            That keeps your profile useful without revealing your birthday.
          </p>
        </FaqItem>

        <FaqItem id="change-role" question="Can I switch from River to Drop, or the other way?">
          <p>
            Not in this demo. A profile keeps the role you chose when you first signed in, so
            pick the one that fits you best.
          </p>
        </FaqItem>

        <FaqItem id="sign-out" question="How do I sign out?">
          <p>
            Use the <strong>Sign out</strong> button next to your name at the top of the page.
            You can sign back in later with the same role, name, and age.
          </p>
        </FaqItem>
      </section>

      <section aria-labelledby="asking-heading" className="space-y-4">
        <h2 id="asking-heading" className="text-2xl font-bold tracking-tight text-ink">
          Asking and answering
        </h2>

        <FaqItem id="ask" question="How do I ask a question?">
          <p>
            Sign in as a Drop, open <Link href="/questions">Questions</Link>, type your
            question, and press <strong>Post question</strong>. You can add topics to help
            Rivers find it. You can also upvote questions you would like answered.
          </p>
        </FaqItem>

        <FaqItem id="answer" question="How do I answer a question?">
          <p>
            Sign in as a River, open <Link href="/senior">Answer</Link>, and choose a question.
            Then type your answer or record it. When you are finished, HistorAI writes a
            story from your answer and shows it to you for review before anything is
            published.
          </p>
        </FaqItem>

        <FaqItem id="record" question="Can I answer by speaking instead of typing?">
          <p>
            Yes. Choose <strong>Record</strong> in the answer form and allow your browser to
            use the microphone. You can listen to the recording before sending it. If the
            microphone is not available, you can always type your answer instead.
          </p>
        </FaqItem>

        <FaqItem id="interviewer" question="What is “Talk with an interviewer”?">
          <p>
            It is a relaxed spoken conversation. A patient AI interviewer asks one question at
            a time, waits while you think, and helps you tell the story out loud. The
            conversation becomes the answer that HistorAI turns into a story.
          </p>
        </FaqItem>

        <FaqItem id="after-submit" question="What happens after I submit an answer?">
          <p>
            HistorAI writes a draft story from your words and runs two checks: one for safety
            and one for accuracy. You then see your original answer next to the story. You can
            publish it, or ask for changes with written or recorded feedback first.
          </p>
        </FaqItem>

        <FaqItem
          id="after-publish"
          question="Can I change a story after it has been published?"
        >
          <p>
            In this demo, publishing is final and there is no edit button afterwards. If
            something in a published story is wrong or upsetting, use the{" "}
            <strong>Report</strong> button on the story so it can be reviewed.
          </p>
        </FaqItem>
      </section>

      <section aria-labelledby="reading-heading" className="space-y-4">
        <h2 id="reading-heading" className="text-2xl font-bold tracking-tight text-ink">
          Reading stories
        </h2>

        <FaqItem id="where-stories" question="Where can I read stories?">
          <p>
            Open <Link href="/youth">Read</Link> in the menu. Every published story appears
            there with the name of the River who shared it.
          </p>
        </FaqItem>

        <FaqItem id="true-stories" question="Are the stories true?">
          <p>
            Stories are based on a River&apos;s own answer. The AI is instructed not to invent
            facts, and a separate review checks the story against the original answer before
            it can be published.
          </p>
        </FaqItem>

        <FaqItem id="comments" question="Can I comment on or react to a story?">
          <p>
            There are no comments in this demo. If a story or question is disrespectful,
            misleading, or shares private information, use the <strong>Report</strong> button
            on it. You can also upvote questions you want to see answered.
          </p>
        </FaqItem>

        <FaqItem id="copy" question="Can I copy a title or a story?">
          <p>
            Yes. Use the <strong>Copy</strong> button next to a question or story title to copy
            it. On a question page, each answer has a copy button, and on a story page the{" "}
            <strong>Copy story</strong> button copies the full text. You can then paste it into
            a message, email, or document.
          </p>
        </FaqItem>
      </section>

      <section aria-labelledby="safety-heading" className="space-y-4">
        <h2 id="safety-heading" className="text-2xl font-bold tracking-tight text-ink">
          Safety and privacy
        </h2>

        <FaqItem id="family-friendly" question="How do you keep content family-friendly?">
          <p>
            Every question, name, bio, and story is checked by a safety agent before it
            appears. Mild issues can be cleaned up automatically. Content that is hateful,
            sexual, threatening, graphic, or that gives instructions for harming someone is
            blocked.
          </p>
        </FaqItem>

        <FaqItem
          id="cleaned-content"
          question="Why was my question or bio changed, or refused?"
        >
          <p>
            If a question or bio contains mild language, HistorAI may clean it up and show
            you a short notice. If it contains harmful content, it is refused instead. In
            that case, please rephrase your question or choose a different name or bio.
          </p>
        </FaqItem>

        <FaqItem id="report" question="How do I report something?">
          <p>
            Use the <strong>Report</strong> button on the question, answer, or story. Choose a
            reason and add any details you think are useful. Your report is saved for a
            moderator to review.
          </p>
        </FaqItem>

        <FaqItem id="privacy" question="What can other people see about me?">
          <p>
            Other people can see your name, age range, role, bio, interests, your questions,
            and any stories you have published. Your exact age is not shown. Questions and
            stories are public, so please do not put private details in them.
          </p>
        </FaqItem>

        <FaqItem id="recording" question="Is my voice recording shown to other people?">
          <p>
            No. Your recording is used to write down your answer and create the story. The
            published page shows the written story and the question it answers, not the audio
            file.
          </p>
        </FaqItem>

        <FaqItem id="personal-information" question="Should I share personal information?">
          <p>
            Please do not share your address, phone number, email address, passwords, or
            financial details in a question, answer, bio, or recording. If you accidentally
            share private information, use the <strong>Report</strong> button right away.
          </p>
        </FaqItem>
      </section>

      <section aria-labelledby="accessibility-heading" className="space-y-4">
        <h2 id="accessibility-heading" className="text-2xl font-bold tracking-tight text-ink">
          Accessibility
        </h2>

        <FaqItem id="text-size" question="How do I make the text bigger?">
          <p>
            Use the <strong>A</strong>, <strong>A+</strong>, and <strong>A++</strong> buttons
            at the top of every page. A++ is the largest. Your choice is remembered on this
            device. You can also zoom with your browser or operating system settings.
          </p>
        </FaqItem>

        <FaqItem id="keyboard" question="Can I use a keyboard or screen reader?">
          <p>
            Yes. Every page starts with a <strong>Skip to content</strong> link when you press
            Tab, buttons and answers can be reached with Tab and opened with Enter or Space,
            and a visible outline shows where you are. Form fields have labels, and important
            messages are announced to screen readers.
          </p>
        </FaqItem>

        <FaqItem id="devices" question="Does HistorAI work on a phone or tablet?">
          <p>
            Yes. The pages adjust to smaller screens. The Help button stays at the top, so you
            can come back to this page from any device.
          </p>
        </FaqItem>
      </section>
    </div>
  );
}
