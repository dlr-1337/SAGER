package br.edu.ifgoiano.sager.reports;
import org.springframework.http.HttpStatus;
public class ReportingApiException extends RuntimeException {
 private final HttpStatus status; private final String code;
 public ReportingApiException(HttpStatus status,String code,String message) {super(message);this.status=status;this.code=code;}
 public HttpStatus status(){return status;} public String code(){return code;}
 public static ReportingApiException invalid(String message){return new ReportingApiException(HttpStatus.BAD_REQUEST,"invalid_input",message);}
 public static ReportingApiException missing(){return new ReportingApiException(HttpStatus.NOT_FOUND,"not_found","Recurso não encontrado.");}
 public static ReportingApiException conflict(String code,String message){return new ReportingApiException(HttpStatus.CONFLICT,code,message);}
 public static ReportingApiException expired(){return new ReportingApiException(HttpStatus.GONE,"report_expired","A consulta expirou. Crie uma nova consulta.");}
}
