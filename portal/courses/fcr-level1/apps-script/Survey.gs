/**
 * Course evaluation form for Foundations of Clinical Research · Level 1.
 *
 * Run setupSurvey() once from the editor, after setup(). It creates an anonymous, bilingual
 * Google Form in the "Neudata Certificates" folder. Its confirmation page shows
 * CONFIG.surveyCode, which participants enter on the certificate page. The same form is the
 * course evaluation in Session 8. Running it again keeps the existing form.
 *
 * The questions are those of Course/Assessment/course_evaluation.md (and _VN.md) in the
 * course repository, in the same order. If a form was made with an older version of this
 * script, run rebuildSurvey() once: it makes a new form and uses its link from then on (the
 * old form stays in Drive with its answers). The survey code does not change.
 */
function setupSurvey() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SURVEY_ID')) {
    Logger.log('Survey already exists: %s', props.getProperty('SURVEY_URL'));
    return;
  }
  const form = FormApp.create('FCR Level 1 · Course evaluation');
  form.setDescription(
    'Foundations of Clinical Research · Level 1. About 5 minutes. Anonymous: we do not record your name or email. Only the trainers read the answers.\n' +
    'Nền tảng Nghiên cứu Lâm sàng · Cấp độ 1. Khoảng 5 phút. Ẩn danh: chúng tôi không ghi lại tên hay email của bạn. Chỉ giảng viên đọc câu trả lời.')
    .setCollectEmail(false)
    .setRequireLogin(false)
    .setLimitOneResponsePerUser(false)
    .setShowLinkToRespondAgain(false)
    .setConfirmationMessage(
      'Thank you! Your survey completion code is ' + CONFIG.surveyCode + '. Enter it on the certificate page.\n' +
      'Cảm ơn bạn! Mã hoàn thành khảo sát của bạn là ' + CONFIG.surveyCode + '. Nhập mã này ở trang nhận chứng nhận.');

  const five = ['1', '2', '3', '4', '5'];

  // A. About you (optional)
  form.addSectionHeaderItem().setTitle('A. About you (optional) / Về bạn (không bắt buộc)');
  form.addMultipleChoiceItem().setTitle('Your profession / Nghề nghiệp của bạn')
    .setChoiceValues(['Doctor / Bác sĩ', 'Nurse / Điều dưỡng', 'Pharmacist / Dược sĩ',
      'Other health professional / Nhân viên y tế khác', 'Other / Khác']);
  form.addMultipleChoiceItem().setTitle('How many of the 8 sessions did you attend? / Bạn đã tham dự bao nhiêu buổi trong 8 buổi?')
    .setChoiceValues(['8', '6-7', '4-5', '3 or fewer / 3 buổi trở xuống']);

  // B. Overall
  form.addSectionHeaderItem().setTitle('B. Overall / Nhìn chung');
  form.addScaleItem().setTitle('Overall, how would you rate the course? / Nhìn chung, bạn đánh giá khóa học thế nào?')
    .setBounds(1, 5).setLabels('Poor / Kém', 'Excellent / Rất tốt').setRequired(true);
  form.addScaleItem().setTitle('The course met my expectations / Khóa học đáp ứng mong đợi của tôi')
    .setBounds(1, 5).setLabels('Not at all / Hoàn toàn không', 'Fully / Hoàn toàn');
  form.addMultipleChoiceItem().setTitle('Would you recommend this course to a colleague? / Bạn có giới thiệu khóa học này cho đồng nghiệp không?')
    .setChoiceValues(['Yes / Có', 'Maybe / Có thể', 'No / Không']);

  // C. Each session
  form.addSectionHeaderItem().setTitle('C. Each session / Từng buổi học');
  form.addGridItem().setTitle('Rate each session: content and usefulness (1 = poor, 5 = excellent) / Chấm điểm từng buổi: nội dung và mức hữu ích (1 = kém, 5 = rất tốt)')
    .setRows([
      'Session 1 · Ask / Buổi 1 · Đặt câu hỏi',
      'Session 2 · Find and read / Buổi 2 · Tìm và đọc y văn',
      'Session 3 · Design / Buổi 3 · Thiết kế',
      'Session 4 · Bias and effect / Buổi 4 · Sai lệch và đo lường tác động',
      'Session 5 · Data / Buổi 5 · Dữ liệu',
      'Session 6 · Analyse / Buổi 6 · Phân tích',
      'Session 7 · Protect and write / Buổi 7 · Bảo vệ người tham gia và viết bài',
      'Session 8 · Publish / Buổi 8 · Công bố'])
    .setColumns(five);

  // D. What you can do now
  form.addSectionHeaderItem().setTitle('D. What you can do now / Những gì bạn làm được bây giờ');
  form.addGridItem().setTitle('How confident are you now that you can... (1 = not at all, 5 = very confident) / Bây giờ bạn tự tin đến đâu rằng mình có thể... (1 = hoàn toàn không, 5 = rất tự tin)')
    .setRows([
      'write a focused research question (PICO) and objectives / viết một câu hỏi nghiên cứu cụ thể (PICO) và các mục tiêu',
      'search PubMed and manage references with Zotero / tìm kiếm trên PubMed và quản lý tài liệu tham khảo bằng Zotero',
      'choose a study design that fits the question / chọn thiết kế nghiên cứu phù hợp với câu hỏi',
      'recognise bias and confounding, and calculate a risk ratio, odds ratio and number needed to treat from a 2x2 table / nhận ra sai lệch và yếu tố gây nhiễu, và tính tỷ số nguy cơ, tỷ số chênh và số người cần điều trị từ bảng 2x2',
      'design a case report form and describe data in a Table 1 / thiết kế phiếu thu thập dữ liệu (CRF) và mô tả dữ liệu trong Bảng 1',
      'read a 95% confidence interval, a p-value and a regression table / đọc khoảng tin cậy 95%, giá trị p và một bảng hồi quy',
      'plan ethics approval, patient consent and registration / lập kế hoạch xin phê duyệt đạo đức, sự đồng ý của người bệnh và đăng ký nghiên cứu',
      'write a Results section with correct numbers and wording / viết phần Kết quả với số liệu và cách diễn đạt đúng',
      'appraise a published paper and review a colleague\'s draft / thẩm định một bài báo đã công bố và bình duyệt bản nháp của đồng nghiệp'])
    .setColumns(five);

  // E. Format and materials
  form.addSectionHeaderItem().setTitle('E. Format and materials / Hình thức và tài liệu');
  form.addMultipleChoiceItem().setTitle('The pace was / Tốc độ của khóa học')
    .setChoiceValues(['Too slow / Quá chậm', 'About right / Vừa phải', 'Too fast / Quá nhanh']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Time I spent on the course outside the sessions, per week / Thời gian tôi dành cho khóa học ngoài giờ học, mỗi tuần')
    .setChoiceValues(['Less than 1 hour / Dưới 1 giờ', '1-2 hours / 1 đến 2 giờ', '3-4 hours / 3 đến 4 giờ',
      'More than 4 hours / Trên 4 giờ']);
  form.addScaleItem().setTitle('The online evening format (19:30-22:30) worked well for me / Hình thức học trực tuyến buổi tối (19:30-22:30) phù hợp với tôi')
    .setBounds(1, 5).setLabels('Strongly disagree / Hoàn toàn không đồng ý', 'Strongly agree / Hoàn toàn đồng ý');
  form.addGridItem().setTitle('How useful were these materials? (1 = not useful, 5 = very useful) / Các tài liệu sau hữu ích đến đâu? (1 = không hữu ích, 5 = rất hữu ích)')
    .setRows([
      'Slides / Slide bài giảng',
      'Exercise sheets and solutions / Phiếu bài tập và đáp án',
      'Live demos (PubMed, Zotero, R, calculators) / Các phần trình diễn trực tiếp (PubMed, Zotero, R, công cụ tính)',
      'FLUID-ICU results packs / Các gói kết quả FLUID-ICU',
      'Templates (proposal, manuscript and others) / Các mẫu tài liệu (đề cương, bản thảo và các mẫu khác)',
      'Textbook / Giáo trình',
      'The two published papers / Hai bài báo đã công bố'])
    .setColumns(five.concat(['Did not use / Không dùng']));
  form.addScaleItem().setTitle('Writing my own proposal and Results section helped me learn / Tự viết đề cương và phần Kết quả của mình giúp tôi học tốt hơn')
    .setBounds(1, 5).setLabels('Strongly disagree / Hoàn toàn không đồng ý', 'Strongly agree / Hoàn toàn đồng ý');
  form.addScaleItem().setTitle('The trainers explained clearly and answered questions well / Giảng viên giải thích rõ ràng và trả lời câu hỏi tốt')
    .setBounds(1, 5).setLabels('Strongly disagree / Hoàn toàn không đồng ý', 'Strongly agree / Hoàn toàn đồng ý');

  // F. Your comments
  form.addSectionHeaderItem().setTitle('F. Your comments / Ý kiến của bạn');
  form.addParagraphTextItem().setTitle('One thing to keep / Một điều nên giữ');
  form.addParagraphTextItem().setTitle('One thing to change / Một điều nên thay đổi');
  form.addParagraphTextItem().setTitle('A topic you would like more of, or that was missing / Một chủ đề bạn muốn học thêm, hoặc còn thiếu');
  form.addMultipleChoiceItem().setTitle('Are you interested in Level 2 (statistical modelling in R)? / Bạn có quan tâm đến Cấp độ 2 (mô hình thống kê bằng R) không?')
    .setChoiceValues(['Yes / Có', 'Maybe / Có thể', 'No / Không']).setRequired(true);
  form.addParagraphTextItem().setTitle('Any other comment / Ý kiến khác');

  const root = DriveApp.getFolderById(props.getProperty('ROOT_ID'));
  DriveApp.getFileById(form.getId()).moveTo(root);
  props.setProperties({ SURVEY_ID: form.getId(), SURVEY_URL: form.getPublishedUrl() });
  Logger.log('Survey created. Share this link: %s', form.getPublishedUrl());
  Logger.log('Responses: %s', form.getEditUrl());
}

// Make the form again with the current questions. The old form and its answers stay in Drive.
function rebuildSurvey() {
  const props = PropertiesService.getScriptProperties();
  const old = props.getProperty('SURVEY_URL');
  props.deleteProperty('SURVEY_ID');
  props.deleteProperty('SURVEY_URL');
  if (old) Logger.log('Old form kept in Drive: %s', old);
  setupSurvey();
}

// The survey link for the certificate page: CONFIG.surveyUrl if set, else the form from setupSurvey().
function surveyUrl_() {
  return CONFIG.surveyUrl || PropertiesService.getScriptProperties().getProperty('SURVEY_URL') || '';
}
